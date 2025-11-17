import OpenAI from "openai";
import { Logger } from "@nestjs/common";
import { ConfigValidator } from "./validators/config.validator";
import { MessageBuilder } from "./builders/message.builder";
import { RequestBuilder } from "./builders/request.builder";
import { OutputParser } from "./parsers/output.parser";
import { SchemaParser } from "./parsers/schema.parser";
import { RateLimitManager } from "./managers/rate-limit.manager";
import { ThrottleManager } from "./managers/throttle.manager";
import { RetryManager } from "./managers/retry.manager";
import { OpenAIClientConfig } from "./types/config.types";
import { PromptInput, PromptResponse, PromptResponseStatus, PromptCost } from "./types/prompt.types";
import { ModelMetadata, OPENAI_MODEL_REGISTRY, OpenAIModel } from "./config/model-registry";
import { HTTP_STATUS_STRINGS, ERROR_KEYWORDS, DEFAULT_ERROR_MESSAGES } from "./constants/error.constants";

export class OpenAIClientService {
    private readonly logger = new Logger(OpenAIClientService.name);
    private readonly CHARS_PER_TOKEN = 4; // Rough average
    private readonly DEFAULT_ESTIMATED_MAX_TOKENS = 1000;
    private readonly TOKENS_PER_MILLION = 1_000_000;

    private client!: OpenAI;
    private defaultModel!: OpenAIModel;
    private defaultTemperature!: number;
    private systemMessage?: string;
    private maxTokens?: number;

    // Managers and helpers
    private configValidator: ConfigValidator;
    private messageBuilder: MessageBuilder;
    private requestBuilder: RequestBuilder;
    private outputParser: OutputParser;
    private schemaParser: SchemaParser;
    private rateLimitManager: RateLimitManager;
    private throttleManager: ThrottleManager;
    private retryManager: RetryManager;

    constructor(config: OpenAIClientConfig) {
        // Initialize validator
        this.configValidator = new ConfigValidator();

        // Validate and set configuration
        const apiKey = this.configValidator.validateApiKey(config.apiKey);
        this.defaultModel = this.configValidator.validateModel(config.defaultModel);
        this.defaultTemperature = this.configValidator.validateTemperature(config.defaultTemperature);
        this.maxTokens = this.configValidator.validateMaxTokens(config.maxTokens, this.defaultModel);
        this.systemMessage = this.configValidator.validateSystemMessage(config.systemMessage);

        const rateLimits = this.configValidator.validateRateLimits(config.rateLimit);
        const throttleSettings = this.configValidator.validateThrottleSettings(
            config.requestDelay,
            config.useJitter,
            config.jitterFactor
        );
        const retrySettings = this.configValidator.validateRetrySettings(
            config.enableRetry,
            config.maxRetryAttempts,
            config.baseRetryDelay,
            config.maxRetryDelay
        );

        // Initialize OpenAI client
        this.client = new OpenAI({
            apiKey,
            baseURL: config.baseURL,
            organization: config.organization,
            timeout: config.timeout ?? this.configValidator.getDefaultTimeout(),
            maxRetries: 0, // Disable built-in retries, we handle them ourselves
        });

        // Initialize managers and helpers
        this.schemaParser = new SchemaParser();
        this.messageBuilder = new MessageBuilder();
        this.requestBuilder = new RequestBuilder(this.schemaParser);
        this.outputParser = new OutputParser();
        this.rateLimitManager = new RateLimitManager(rateLimits.requestsPerMinute, rateLimits.tokensPerMinute);
        this.throttleManager = new ThrottleManager(
            throttleSettings.requestDelay,
            throttleSettings.useJitter,
            throttleSettings.jitterFactor
        );
        this.retryManager = new RetryManager(
            retrySettings.enabled,
            retrySettings.maxAttempts,
            retrySettings.baseDelay,
            retrySettings.maxDelay
        );
    }

    /**
     * Generate a completion using OpenAI
     */
    async prompt<TInput = string, TOutput = string>(
        input: PromptInput<TInput, TOutput>
    ): Promise<PromptResponse<TInput, TOutput>> {
        return await this.retryManager.executeWithRetry(
            async () => {
                try {
                    return await this.executeWithRateLimiting(async () => {
                        const model = this.getModelToUse(input);
                        const messages = this.messageBuilder.buildMessages(input, model, this.systemMessage);
                        const requestParams = this.requestBuilder.buildRequestParams(
                            input,
                            model,
                            messages,
                            this.defaultTemperature,
                            this.maxTokens
                        );

                        this.logger.debug(`Making OpenAI request with model: ${model}`);
                        const response = await this.client.chat.completions.create(requestParams);

                        this.rateLimitManager.recordRequest(response.usage?.total_tokens);

                        const { content, structuredOutput } = this.outputParser.parseAndValidateOutput(
                            response.choices[0]?.message?.content || "",
                            input.outputSchema
                        );

                        return this.buildPromptResponse(response, content, structuredOutput, input, model);
                    }, this.estimateTokens(input));
                } catch (error) {
                    // Check if error is retriable
                    if (this.retryManager.isRetriableError(error)) {
                        throw error; // Let retry manager handle it
                    }
                    // Non-retriable error, return error response
                    return this.buildErrorResponse<TInput, TOutput>(error, input);
                }
            },
            (error) => this.buildErrorResponse<TInput, TOutput>(error, input)
        );
    }

    /**
     * Generate a streaming completion using OpenAI
     */
    async promptStream<TInput = string, TOutput = string>(
        input: PromptInput<TInput, TOutput>,
        onChunk: (chunk: string) => void
    ): Promise<PromptResponse<TInput, TOutput>> {
        return await this.retryManager.executeWithRetry(
            async () => {
                try {
                    return await this.executeWithRateLimiting(async () => {
                        const model = this.getModelToUse(input);
                        const messages = this.messageBuilder.buildMessages(input, model, this.systemMessage);
                        const requestParams = this.requestBuilder.buildStreamingRequestParams(
                            input,
                            model,
                            messages,
                            this.defaultTemperature,
                            this.maxTokens
                        );

                        this.logger.debug(`Making OpenAI streaming request with model: ${model}`);
                        const stream = await this.client.chat.completions.create(requestParams);

                        const { fullContent, finishReason, modelUsed } = await this.processStream(stream, onChunk);

                        this.rateLimitManager.recordRequest(this.estimateTokens(input));

                        const { content, structuredOutput } = this.outputParser.parseAndValidateOutput(
                            fullContent,
                            input.outputSchema
                        );

                        return {
                            status: PromptResponseStatus.SUCCESS,
                            content,
                            structuredOutput,
                            usage: undefined, // Streaming doesn't provide usage
                            cost: undefined, // Streaming doesn't provide usage, so can't calculate cost
                            model: modelUsed,
                            finishReason,
                            raw: {} as OpenAI.Chat.Completions.ChatCompletion,
                            input,
                        };
                    }, this.estimateTokens(input));
                } catch (error) {
                    // Check if error is retriable
                    if (this.retryManager.isRetriableError(error)) {
                        throw error; // Let retry manager handle it
                    }
                    // Non-retriable error, return error response
                    return this.buildErrorResponse<TInput, TOutput>(error, input);
                }
            },
            (error) => this.buildErrorResponse<TInput, TOutput>(error, input)
        );
    }

    /**
     * Get the model to use for the request
     */
    private getModelToUse<TInput, TOutput>(input: PromptInput<TInput, TOutput>): OpenAIModel {
        return input.model ?? this.defaultModel;
    }

    /**
     * Build the prompt response object
     */
    private buildPromptResponse<TInput, TOutput>(
        response: OpenAI.Chat.Completions.ChatCompletion,
        content: TOutput,
        structuredOutput: TOutput | undefined,
        input: PromptInput<TInput, TOutput>,
        model: OpenAIModel
    ): PromptResponse<TInput, TOutput> {
        const usage = response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            }
            : undefined;

        const cost = usage
            ? this.calculateCost(model, usage.promptTokens, usage.completionTokens)
            : undefined;

        return {
            status: PromptResponseStatus.SUCCESS,
            content,
            structuredOutput,
            toolCalls: response.choices[0]?.message?.tool_calls,
            usage,
            cost,
            model: response.model,
            finishReason: response.choices[0]?.finish_reason ?? null,
            raw: response,
            input,
        };
    }


    /**
     * Build an error response
     */
    private buildErrorResponse<TInput, TOutput>(
        error: unknown,
        input: PromptInput<TInput, TOutput>
    ): PromptResponse<TInput, TOutput> {
        let status = PromptResponseStatus.UNKNOWN_ERROR;
        let errorMessage: string = DEFAULT_ERROR_MESSAGES.UNKNOWN;

        if (error instanceof Error) {
            errorMessage = error.message;

            // Determine the type of error
            if (errorMessage.includes(ERROR_KEYWORDS.SCHEMA_MISMATCH)) {
                status = PromptResponseStatus.VALIDATION_ERROR;
            } else if (
                errorMessage.includes(ERROR_KEYWORDS.RATE_LIMIT) ||
                errorMessage.includes(HTTP_STATUS_STRINGS.TOO_MANY_REQUESTS)
            ) {
                status = PromptResponseStatus.RATE_LIMIT_ERROR;
            } else if (
                errorMessage.includes(ERROR_KEYWORDS.TIMEOUT) ||
                errorMessage.includes(ERROR_KEYWORDS.TIMED_OUT)
            ) {
                status = PromptResponseStatus.TIMEOUT_ERROR;
            } else if (
                errorMessage.includes(ERROR_KEYWORDS.NETWORK) ||
                errorMessage.includes(ERROR_KEYWORDS.ECONNREFUSED) ||
                errorMessage.includes(ERROR_KEYWORDS.ENOTFOUND)
            ) {
                status = PromptResponseStatus.NETWORK_ERROR;
            } else if (
                errorMessage.includes(ERROR_KEYWORDS.API) ||
                errorMessage.includes(HTTP_STATUS_STRINGS.BAD_REQUEST) ||
                errorMessage.includes(HTTP_STATUS_STRINGS.UNAUTHORIZED) ||
                errorMessage.includes(HTTP_STATUS_STRINGS.FORBIDDEN) ||
                errorMessage.includes(HTTP_STATUS_STRINGS.INTERNAL_SERVER_ERROR)
            ) {
                status = PromptResponseStatus.API_ERROR;
            }
        }

        this.logger.error(`Prompt failed with status ${status}:`, errorMessage);

        return {
            status,
            error: errorMessage,
            content: "" as TOutput,
            model: "",
            finishReason: null,
            raw: {} as OpenAI.Chat.Completions.ChatCompletion,
            input,
        };
    }

    /**
     * Process streaming response
     */
    private async processStream(
        stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
        onChunk: (chunk: string) => void
    ): Promise<{ fullContent: string; finishReason: string | null; modelUsed: string }> {
        let fullContent = "";
        let finishReason: string | null = null;
        let modelUsed = "";

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
                fullContent += delta;
                onChunk(delta);
            }

            if (chunk.choices[0]?.finish_reason) {
                finishReason = chunk.choices[0].finish_reason;
            }

            if (chunk.model) {
                modelUsed = chunk.model;
            }
        }

        return { fullContent, finishReason, modelUsed };
    }

    /**
     * Estimate tokens for rate limiting (rough approximation)
     */
    private estimateTokens<TInput, TOutput>(input: PromptInput<TInput, TOutput>): number {
        let totalChars = 0;

        // System message
        const systemMessage = input.systemMessage ?? this.systemMessage;
        if (systemMessage) {
            totalChars += systemMessage.length;
        }

        // User input
        const inputString = typeof input.input === "string" ? input.input : JSON.stringify(input.input);
        totalChars += inputString.length;

        // Conversation history
        if (input.messages) {
            for (const message of input.messages) {
                if (typeof message.content === "string") {
                    totalChars += message.content.length;
                }
            }
        }

        // Max tokens for response
        const maxTokens = input.maxTokens ?? this.maxTokens ?? this.DEFAULT_ESTIMATED_MAX_TOKENS;

        return Math.ceil(totalChars / this.CHARS_PER_TOKEN) + maxTokens;
    }

    /**
     * Wrapper for API calls with rate limiting and throttling
     */
    private async executeWithRateLimiting<T>(fn: () => Promise<T>, estimatedTokens: number = 0): Promise<T> {
        await this.throttleManager.throttle();

        await this.rateLimitManager.waitForRateLimit(estimatedTokens);
        this.rateLimitManager.recordRequest(estimatedTokens);

        return fn();
    }

    /**
     * Calculate estimated cost for a request
     */
    private calculateCost(model: OpenAIModel, inputTokens: number, outputTokens: number): PromptCost {
        const metadata = this.getModelMetadata(model);
        const inputCost = (inputTokens / this.TOKENS_PER_MILLION) * metadata.pricing.inputPer1M;
        const outputCost = (outputTokens / this.TOKENS_PER_MILLION) * metadata.pricing.outputPer1M;
        const totalCost = inputCost + outputCost;

        return {
            inputCost,
            outputCost,
            totalCost,
        };
    }

    private getModelMetadata(model: OpenAIModel): ModelMetadata {
        const metadata = OPENAI_MODEL_REGISTRY[model];

        if (!metadata) {
            throw new Error(`Model metadata not found for: ${model}`);
        }

        return metadata;
    }
}
