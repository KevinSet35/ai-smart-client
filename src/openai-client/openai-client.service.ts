import OpenAI from "openai";
import { Logger } from "@nestjs/common";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { OPENAI_MODEL_REGISTRY, OpenAIModel } from "./openai-registry";

/**
 * Status of the prompt response
 */
export enum PromptResponseStatus {
    SUCCESS = "success",
    VALIDATION_ERROR = "validation_error",
    API_ERROR = "api_error",
    RATE_LIMIT_ERROR = "rate_limit_error",
    TIMEOUT_ERROR = "timeout_error",
    NETWORK_ERROR = "network_error",
    UNKNOWN_ERROR = "unknown_error",
}

/**
 * Configuration options for the OpenAI client wrapper
 */
export interface OpenAIClientConfig {
    /** OpenAI API key. If not provided, reads from OPENAI_API_KEY environment variable */
    apiKey?: string;
    /** Default model to use for completions. Defaults to GPT_4O */
    defaultModel?: OpenAIModel;
    /** Default temperature (0-2). Defaults to 0.7 */
    defaultTemperature?: number;
    /** Default system message for all prompts */
    systemMessage?: string;
    /** Maximum number of tokens in the response. Optional */
    maxTokens?: number;
    /** Custom base URL for OpenAI API (useful for proxies or Azure). Optional */
    baseURL?: string;
    /** Organization ID for OpenAI API. Optional */
    organization?: string;
    /** Request timeout in milliseconds. Defaults to 60000 (60s) */
    timeout?: number;
    /** Maximum number of retries for failed requests. Defaults to 2 */
    maxRetries?: number;
    /** Rate limiting configuration */
    rateLimit?: {
        /** Maximum requests per minute. Optional */
        requestsPerMinute?: number;
        /** Maximum tokens per minute. Optional */
        tokensPerMinute?: number;
    };
    /** Minimum delay between requests in milliseconds. Optional */
    requestDelay?: number;
    /** Add randomized jitter to request delay. Defaults to true */
    useJitter?: boolean;
    /** Maximum jitter as percentage of requestDelay (0-1). Defaults to 0.3 (30%) */
    jitterFactor?: number;
}

/**
 * Input for prompt generation
 */
export interface PromptInput<T = string> {
    /** User input message or structured data */
    input: string | T;
    /** Override default model for this request */
    model?: OpenAIModel;
    /** Override default temperature for this request */
    temperature?: number;
    /** Override default system message for this request */
    systemMessage?: string;
    /** Override default max tokens for this request */
    maxTokens?: number;
    /** Zod schema for structured output validation */
    outputSchema?: z.ZodType<T>;
    /** Function/tool definitions for function calling */
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
    /** How the model should use tools: 'auto', 'none', or specific tool */
    toolChoice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
    /** Image URLs for vision-capable models */
    images?: string[];
    /** Additional conversation history */
    messages?: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}

/**
 * Response from prompt generation
 */
export interface PromptResponse<T = string> {
    /** Status of the response */
    status: PromptResponseStatus;
    /** Error message if status is not SUCCESS */
    error?: string;
    /** The generated content (validated against outputSchema if provided) */
    content: T;
    /** Parsed and validated structured output (if outputSchema was provided) */
    structuredOutput?: T;
    /** Tool calls made by the model (if tools were provided) */
    toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
    /** Token usage statistics */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    /** The model used for this completion */
    model: string;
    /** Finish reason */
    finishReason: string | null;
    /** Raw OpenAI response */
    raw: OpenAI.Chat.Completions.ChatCompletion;
}

export class OpenAIClientService {
    private readonly logger = new Logger(OpenAIClientService.name);

    // API Key Configuration
    private readonly OPENAI_API_KEY_PREFIX = "sk-";

    // Client Configuration Defaults
    private readonly DEFAULT_TIMEOUT_MS = 60000; // 60 seconds
    private readonly DEFAULT_MAX_RETRIES = 2;

    // Temperature Configuration
    private readonly DEFAULT_TEMPERATURE = 0.7;
    private readonly MIN_TEMPERATURE = 0;
    private readonly MAX_TEMPERATURE = 2;

    // Token Configuration
    private readonly MIN_MAX_TOKENS = 1;
    private readonly DEFAULT_ESTIMATED_MAX_TOKENS = 1000;

    // Rate Limiting Configuration
    private readonly MIN_REQUESTS_PER_MINUTE = 1;
    private readonly MIN_TOKENS_PER_MINUTE = 1;

    // Request Delay Configuration
    private readonly MIN_REQUEST_DELAY_MS = 0;

    // Jitter Configuration
    private readonly DEFAULT_USE_JITTER = true;
    private readonly DEFAULT_JITTER_FACTOR = 0.3; // 30% jitter
    private readonly MIN_JITTER_FACTOR = 0;
    private readonly MAX_JITTER_FACTOR = 1;

    // Rate Limiting Time Window
    private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

    // Throttle Check Interval
    private readonly THROTTLE_CHECK_INTERVAL_MS = 1000; // 1 second

    // Token Estimation
    private readonly CHARS_PER_TOKEN = 4; // Rough average

    private defaultModel!: OpenAIModel;
    private defaultTemperature!: number;
    private systemMessage?: string;
    private maxTokens?: number;
    private client!: OpenAI;

    // Rate limiting properties
    private requestTimestamps: number[] = [];
    private tokenTimestamps: Array<{ timestamp: number; tokens: number }> = [];
    private requestsPerMinute?: number;
    private tokensPerMinute?: number;

    // Throttling properties
    private lastRequestTime = 0;
    private requestDelay?: number;
    private useJitter!: boolean;
    private jitterFactor!: number;

    constructor(config: OpenAIClientConfig) {
        this.validateAndInitializeApiKey(config.apiKey);
        this.initializeOpenAIClient(config);
        this.validateAndSetDefaultModel(config.defaultModel);
        this.validateAndSetTemperature(config.defaultTemperature);
        this.validateAndSetMaxTokens(config.maxTokens);
        this.validateAndSetSystemMessage(config.systemMessage);
        this.validateAndSetRateLimits(config.rateLimit);
        this.validateAndSetThrottleSettings(config.requestDelay, config.useJitter, config.jitterFactor);
    }

    /**
     * Generate a completion using OpenAI
     */
    async prompt<T = string>(input: PromptInput<T>): Promise<PromptResponse<T>> {
        try {
            return await this.executeWithRateLimiting(async () => {
                const model = this.getModelToUse(input);
                const messages = this.buildMessages(input, model);
                const requestParams = this.buildRequestParams(input, model, messages);

                this.logger.debug(`Making OpenAI request with model: ${model}`);
                const response = await this.client.chat.completions.create(requestParams);

                this.recordTokenUsage(response.usage?.total_tokens);

                const { content, structuredOutput } = this.parseAndValidateOutput(
                    response.choices[0]?.message?.content || "",
                    input.outputSchema
                );

                return this.buildPromptResponse(response, content, structuredOutput);
            }, this.estimateTokens(input));
        } catch (error) {
            return this.buildErrorResponse<T>(error);
        }
    }

    /**
     * Generate a streaming completion using OpenAI
     */
    async promptStream<T = string>(
        input: PromptInput<T>,
        onChunk: (chunk: string) => void
    ): Promise<PromptResponse<T>> {
        try {
            return await this.executeWithRateLimiting(async () => {
                const model = this.getModelToUse(input);
                const messages = this.buildMessages(input, model);
                const requestParams = this.buildStreamingRequestParams(input, model, messages);

                this.logger.debug(`Making OpenAI streaming request with model: ${model}`);
                const stream = await this.client.chat.completions.create(requestParams);

                const { fullContent, finishReason, modelUsed } = await this.processStream(stream, onChunk);

                this.recordTokenUsage(this.estimateTokens(input));

                const { content, structuredOutput } = this.parseAndValidateOutput(fullContent, input.outputSchema);

                return {
                    status: PromptResponseStatus.SUCCESS,
                    content,
                    structuredOutput,
                    usage: undefined, // Streaming doesn't provide usage
                    model: modelUsed,
                    finishReason,
                    raw: {} as OpenAI.Chat.Completions.ChatCompletion,
                };
            }, this.estimateTokens(input));
        } catch (error) {
            return this.buildErrorResponse<T>(error);
        }
    }

    // ==================== Validation & Initialization Methods ====================

    /**
     * Validate and initialize the OpenAI API key
     */
    private validateAndInitializeApiKey(apiKey?: string): void {
        const key = apiKey ?? process.env.OPENAI_API_KEY;

        if (!key) {
            throw new Error(
                "OpenAI API key not found. Provide it via:\n" +
                "1. OpenAIClient({ apiKey: '...' })\n" +
                "2. OPENAI_API_KEY environment variable"
            );
        }

        if (!key.startsWith(this.OPENAI_API_KEY_PREFIX)) {
            throw new Error(`Invalid OpenAI API key format. API keys should start with '${this.OPENAI_API_KEY_PREFIX}'`);
        }
    }

    /**
     * Initialize the OpenAI client with configuration
     */
    private initializeOpenAIClient(config: OpenAIClientConfig): void {
        this.client = new OpenAI({
            apiKey: config.apiKey ?? process.env.OPENAI_API_KEY!,
            baseURL: config.baseURL,
            organization: config.organization,
            timeout: config.timeout ?? this.DEFAULT_TIMEOUT_MS,
            maxRetries: config.maxRetries ?? this.DEFAULT_MAX_RETRIES,
        });
    }

    /**
     * Validate and set the default model
     */
    private validateAndSetDefaultModel(model?: OpenAIModel): void {
        this.defaultModel = model ?? OpenAIModel.GPT_4O;

        const isValidModel = Object.values(OpenAIModel).includes(this.defaultModel);
        if (!isValidModel) {
            const validModels = Object.values(OpenAIModel).join(", ");
            throw new Error(`Invalid model: "${this.defaultModel}". Must be one of: ${validModels}`);
        }
    }

    /**
     * Validate and set the default temperature
     */
    private validateAndSetTemperature(temperature?: number): void {
        this.defaultTemperature = temperature ?? this.DEFAULT_TEMPERATURE;

        if (typeof this.defaultTemperature !== "number" || isNaN(this.defaultTemperature)) {
            throw new Error("Temperature must be a valid number");
        }

        if (this.defaultTemperature < this.MIN_TEMPERATURE || this.defaultTemperature > this.MAX_TEMPERATURE) {
            throw new Error(`Temperature must be between ${this.MIN_TEMPERATURE} and ${this.MAX_TEMPERATURE}`);
        }
    }

    /**
     * Validate and set max tokens
     */
    private validateAndSetMaxTokens(maxTokens?: number): void {
        if (maxTokens === undefined) {
            this.maxTokens = undefined;
            return;
        }

        if (typeof maxTokens !== "number" || isNaN(maxTokens) || maxTokens < this.MIN_MAX_TOKENS) {
            throw new Error(`maxTokens must be a positive number (at least ${this.MIN_MAX_TOKENS})`);
        }

        const modelMetadata = OPENAI_MODEL_REGISTRY[this.defaultModel];
        if (maxTokens > modelMetadata.contextWindow) {
            throw new Error(`maxTokens (${maxTokens}) exceeds model's context window (${modelMetadata.contextWindow})`);
        }

        this.maxTokens = maxTokens;
    }

    /**
     * Validate and set system message
     */
    private validateAndSetSystemMessage(systemMessage?: string): void {
        if (systemMessage === undefined) {
            this.systemMessage = undefined;
            return;
        }

        if (typeof systemMessage !== "string") {
            throw new Error("System message must be a string");
        }

        if (systemMessage.trim().length === 0) {
            throw new Error("System message cannot be empty or whitespace only");
        }

        this.systemMessage = systemMessage;
    }

    /**
     * Validate and set rate limiting configuration
     */
    private validateAndSetRateLimits(rateLimit?: OpenAIClientConfig["rateLimit"]): void {
        if (!rateLimit) return;

        if (rateLimit.requestsPerMinute !== undefined) {
            if (rateLimit.requestsPerMinute < this.MIN_REQUESTS_PER_MINUTE) {
                throw new Error(`requestsPerMinute must be at least ${this.MIN_REQUESTS_PER_MINUTE}`);
            }
            this.requestsPerMinute = rateLimit.requestsPerMinute;
        }

        if (rateLimit.tokensPerMinute !== undefined) {
            if (rateLimit.tokensPerMinute < this.MIN_TOKENS_PER_MINUTE) {
                throw new Error(`tokensPerMinute must be at least ${this.MIN_TOKENS_PER_MINUTE}`);
            }
            this.tokensPerMinute = rateLimit.tokensPerMinute;
        }
    }

    /**
     * Validate and set throttle settings
     */
    private validateAndSetThrottleSettings(
        requestDelay?: number,
        useJitter?: boolean,
        jitterFactor?: number
    ): void {
        if (requestDelay !== undefined) {
            if (requestDelay < this.MIN_REQUEST_DELAY_MS) {
                throw new Error(`requestDelay must be non-negative (at least ${this.MIN_REQUEST_DELAY_MS}ms)`);
            }
            this.requestDelay = requestDelay;
        }

        this.useJitter = useJitter ?? this.DEFAULT_USE_JITTER;
        this.jitterFactor = jitterFactor ?? this.DEFAULT_JITTER_FACTOR;

        if (this.jitterFactor < this.MIN_JITTER_FACTOR || this.jitterFactor > this.MAX_JITTER_FACTOR) {
            throw new Error(`jitterFactor must be between ${this.MIN_JITTER_FACTOR} and ${this.MAX_JITTER_FACTOR}`);
        }
    }

    // ==================== Message Building Methods ====================

    /**
     * Get the model to use for the request
     */
    private getModelToUse<T>(input: PromptInput<T>): OpenAIModel {
        return input.model ?? this.defaultModel;
    }

    /**
     * Build the messages array for the request
     */
    private buildMessages<T>(
        input: PromptInput<T>,
        model: OpenAIModel
    ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        this.addSystemMessage(messages, input.systemMessage);
        this.addConversationHistory(messages, input.messages);
        this.addUserInput(messages, input, model);

        return messages;
    }

    /**
     * Add system message to messages array
     */
    private addSystemMessage(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        systemMessage?: string
    ): void {
        const message = systemMessage ?? this.systemMessage;
        if (message) {
            messages.push({
                role: "system",
                content: message,
            });
        }
    }

    /**
     * Add conversation history to messages array
     */
    private addConversationHistory(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        history?: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    ): void {
        if (history) {
            messages.push(...history);
        }
    }

    /**
     * Add user input to messages array
     */
    private addUserInput<T>(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        input: PromptInput<T>,
        model: OpenAIModel
    ): void {
        const hasImages = input.images && input.images.length > 0;
        const modelMetadata = OPENAI_MODEL_REGISTRY[model];

        if (hasImages && modelMetadata.supportsVision) {
            this.addVisionUserMessage(messages, input);
        } else {
            this.addTextUserMessage(messages, input);
        }
    }

    /**
     * Add vision user message with images
     */
    private addVisionUserMessage<T>(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        input: PromptInput<T>
    ): void {
        const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: this.stringifyInput(input.input),
            },
        ];

        for (const imageUrl of input.images!) {
            content.push({
                type: "image_url",
                image_url: { url: imageUrl },
            });
        }

        messages.push({
            role: "user",
            content,
        });
    }

    /**
     * Add text user message
     */
    private addTextUserMessage<T>(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        input: PromptInput<T>
    ): void {
        messages.push({
            role: "user",
            content: this.stringifyInput(input.input),
        });
    }

    /**
     * Convert input to string format
     */
    private stringifyInput<T>(input: string | T): string {
        return typeof input === "string" ? input : JSON.stringify(input);
    }

    // ==================== Request Building Methods ====================

    /**
     * Build request parameters for non-streaming request
     */
    private buildRequestParams<T>(
        input: PromptInput<T>,
        model: OpenAIModel,
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    ): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
        const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
            model,
            messages,
            temperature: input.temperature ?? this.defaultTemperature,
            max_tokens: input.maxTokens ?? this.maxTokens,
        };

        this.addStructuredOutput(requestParams, input.outputSchema, model);
        this.addTools(requestParams, input.tools, input.toolChoice, model);

        return requestParams;
    }

    /**
     * Build request parameters for streaming request
     */
    private buildStreamingRequestParams<T>(
        input: PromptInput<T>,
        model: OpenAIModel,
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    ): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
        const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
            model,
            messages,
            temperature: input.temperature ?? this.defaultTemperature,
            max_tokens: input.maxTokens ?? this.maxTokens,
            stream: true,
        };

        this.addStructuredOutput(requestParams, input.outputSchema, model); // ✅ ADD THIS
        this.addTools(requestParams, input.tools, input.toolChoice, model);

        return requestParams;
    }

    /**
     * Add structured output configuration to request params
     */
    private addStructuredOutput<T>(
        requestParams:
            | OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
            | OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
        outputSchema: z.ZodType<T> | undefined,
        model: OpenAIModel
    ): void {
        if (!outputSchema) return;

        const modelMetadata = OPENAI_MODEL_REGISTRY[model];
        if (!modelMetadata.supportsStructuredOutput) return;

        const jsonSchema = this.zodToOpenAISchema(outputSchema);

        requestParams.response_format = {
            type: "json_schema",
            json_schema: {
                name: "response",
                schema: jsonSchema,
                strict: true,
            },
        };
    }

    /**
     * Add tools configuration to request params
     */
    private addTools(
        requestParams:
            | OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
            | OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
        tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
        toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption | undefined,
        model: OpenAIModel
    ): void {
        if (!tools || tools.length === 0) return;

        const modelMetadata = OPENAI_MODEL_REGISTRY[model];
        if (!modelMetadata.supportsFunctionCalling) return;

        requestParams.tools = tools;
        if (toolChoice) {
            requestParams.tool_choice = toolChoice;
        }
    }

    // ==================== Response Processing Methods ====================

    /**
  * Parse and validate output against schema
  */
    private parseAndValidateOutput<T>(
        rawContent: string,
        outputSchema: z.ZodType<T> | undefined
    ): { content: T; structuredOutput?: T } {
        if (!outputSchema || !rawContent) {
            return { content: rawContent as T };
        }

        try {
            const parsed = JSON.parse(rawContent);
            const validated = outputSchema.parse(parsed);

            this.logger.debug("Successfully validated output against Zod schema");
            return { content: validated, structuredOutput: validated };
        } catch (error) {
            if (error instanceof z.ZodError) {
                this.logger.error("Output validation failed:", error.errors);
                throw new Error(
                    `OpenAI response does not match expected schema: ${error.errors
                        .map((e) => `${e.path.join(".")}: ${e.message}`)
                        .join(", ")}`
                );
            }

            this.logger.warn("Failed to parse structured output, returning raw content", error);
            return { content: rawContent as T };
        }
    }

    /**
     * Build the prompt response object
     */
    private buildPromptResponse<T>(
        response: OpenAI.Chat.Completions.ChatCompletion,
        content: T,
        structuredOutput?: T
    ): PromptResponse<T> {
        return {
            status: PromptResponseStatus.SUCCESS,
            content,
            structuredOutput,
            toolCalls: response.choices[0]?.message?.tool_calls,
            usage: response.usage
                ? {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens,
                }
                : undefined,
            model: response.model,
            finishReason: response.choices[0]?.finish_reason || null,
            raw: response,
        };
    }

    /**
     * Build an error response
     */
    private buildErrorResponse<T>(error: unknown): PromptResponse<T> {
        let status = PromptResponseStatus.UNKNOWN_ERROR;
        let errorMessage = "An unknown error occurred";

        if (error instanceof Error) {
            errorMessage = error.message;

            // Determine the type of error
            if (error.message.includes("does not match expected schema")) {
                status = PromptResponseStatus.VALIDATION_ERROR;
            } else if (error.message.includes("rate limit") || error.message.includes("429")) {
                status = PromptResponseStatus.RATE_LIMIT_ERROR;
            } else if (error.message.includes("timeout") || error.message.includes("timed out")) {
                status = PromptResponseStatus.TIMEOUT_ERROR;
            } else if (
                error.message.includes("network") ||
                error.message.includes("ECONNREFUSED") ||
                error.message.includes("ENOTFOUND")
            ) {
                status = PromptResponseStatus.NETWORK_ERROR;
            } else if (
                error.message.includes("API") ||
                error.message.includes("400") ||
                error.message.includes("401") ||
                error.message.includes("403") ||
                error.message.includes("500")
            ) {
                status = PromptResponseStatus.API_ERROR;
            }
        }

        this.logger.error(`Prompt failed with status ${status}:`, errorMessage);

        return {
            status,
            error: errorMessage,
            content: "" as T,
            model: "",
            finishReason: null,
            raw: {} as OpenAI.Chat.Completions.ChatCompletion,
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

    // ==================== Utility Methods ====================

    /**
     * Convert Zod schema to OpenAI JSON Schema format
     */
    private zodToOpenAISchema<T>(zodSchema: z.ZodType<T>): Record<string, any> {
        const jsonSchema = zodToJsonSchema(zodSchema, {
            target: "openApi3",
            $refStrategy: "none",
        });

        // Remove $schema property as OpenAI doesn't accept it
        const { $schema, ...schema } = jsonSchema as any;

        // Clean up the schema to ensure OpenAI compatibility
        this.cleanSchemaForOpenAI(schema);

        // DEBUG: Log the schema being sent to OpenAI
        // this.logger.debug("Generated OpenAI Schema:", JSON.stringify(schema, null, 2));

        return schema;
    }

    /**
     * Recursively clean schema to ensure OpenAI compatibility
     */
    private cleanSchemaForOpenAI(schema: any): void {
        if (typeof schema !== "object" || schema === null) {
            return;
        }

        // Remove unsupported properties
        const unsupportedProps = ["markdownDescription", "errorMessage", "definitions", "$defs"];
        for (const prop of unsupportedProps) {
            delete schema[prop];
        }

        // Fix boolean exclusiveMinimum/exclusiveMaximum (OpenAI expects numbers, not booleans)
        if (typeof schema.exclusiveMinimum === "boolean") {
            if (schema.exclusiveMinimum === true && typeof schema.minimum === "number") {
                schema.exclusiveMinimum = schema.minimum;
                delete schema.minimum;
            } else {
                delete schema.exclusiveMinimum;
            }
        }

        if (typeof schema.exclusiveMaximum === "boolean") {
            if (schema.exclusiveMaximum === true && typeof schema.maximum === "number") {
                schema.exclusiveMaximum = schema.maximum;
                delete schema.maximum;
            } else {
                delete schema.exclusiveMaximum;
            }
        }

        // Handle .positive() - converts to minimum > 0
        if (schema.type === "number" && schema.exclusiveMinimum === 0) {
            // For positive numbers, use minimum: 0 with exclusiveMinimum removed
            // or use a very small positive number
            delete schema.exclusiveMinimum;
            schema.minimum = 0;
        }

        // Ensure additionalProperties is false for objects (required by OpenAI strict mode)
        if (schema.type === "object") {
            if (!schema.hasOwnProperty("additionalProperties")) {
                schema.additionalProperties = false;
            }
            // Ensure all nested objects also have additionalProperties: false
            if (schema.properties) {
                for (const key in schema.properties) {
                    this.cleanSchemaForOpenAI(schema.properties[key]);
                }
            }
        }

        // Recursively clean nested schemas
        if (schema.items) {
            this.cleanSchemaForOpenAI(schema.items);
        }

        if (schema.anyOf) {
            schema.anyOf.forEach((s: any) => this.cleanSchemaForOpenAI(s));
        }

        if (schema.allOf) {
            schema.allOf.forEach((s: any) => this.cleanSchemaForOpenAI(s));
        }

        if (schema.oneOf) {
            schema.oneOf.forEach((s: any) => this.cleanSchemaForOpenAI(s));
        }
    }

    /**
     * Estimate tokens for rate limiting (rough approximation)
     */
    private estimateTokens<T>(input: PromptInput<T>): number {
        let totalChars = 0;

        // System message
        const systemMessage = input.systemMessage ?? this.systemMessage;
        if (systemMessage) {
            totalChars += systemMessage.length;
        }

        // User input
        totalChars += this.stringifyInput(input.input).length;

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

    // ==================== Rate Limiting & Throttling Methods ====================

    /**
     * Record token usage for rate limiting
     */
    private recordTokenUsage(tokensUsed?: number): void {
        if (tokensUsed) {
            this.recordRequest(tokensUsed);
        }
    }

    /**
     * Check if we can make a request based on rate limits
     */
    private canMakeRequest(estimatedTokens: number = 0): boolean {
        const now = Date.now();
        const oneMinuteAgo = now - this.RATE_LIMIT_WINDOW_MS;

        // Clean up old timestamps
        this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > oneMinuteAgo);
        this.tokenTimestamps = this.tokenTimestamps.filter((t) => t.timestamp > oneMinuteAgo);

        // Check request rate limit
        if (this.isRequestRateLimitExceeded()) {
            return false;
        }

        // Check token rate limit
        if (this.isTokenRateLimitExceeded(estimatedTokens)) {
            return false;
        }

        return true;
    }

    /**
     * Check if request rate limit is exceeded
     */
    private isRequestRateLimitExceeded(): boolean {
        return this.requestsPerMinute !== undefined && this.requestTimestamps.length >= this.requestsPerMinute;
    }

    /**
     * Check if token rate limit is exceeded
     */
    private isTokenRateLimitExceeded(estimatedTokens: number): boolean {
        if (this.tokensPerMinute === undefined || estimatedTokens === 0) {
            return false;
        }

        const tokensUsedInLastMinute = this.tokenTimestamps.reduce((sum, t) => sum + t.tokens, 0);
        return tokensUsedInLastMinute + estimatedTokens > this.tokensPerMinute;
    }

    /**
     * Record a request for rate limiting
     */
    private recordRequest(tokensUsed: number = 0): void {
        const now = Date.now();
        this.requestTimestamps.push(now);

        if (tokensUsed > 0) {
            this.tokenTimestamps.push({ timestamp: now, tokens: tokensUsed });
        }
    }

    /**
     * Wait until we can make a request
     */
    private async waitForRateLimit(estimatedTokens: number = 0): Promise<void> {
        while (!this.canMakeRequest(estimatedTokens)) {
            await this.sleep(this.THROTTLE_CHECK_INTERVAL_MS);
        }
    }

    /**
     * Calculate delay with optional jitter
     */
    private calculateDelay(baseDelay: number): number {
        if (!this.useJitter) {
            return baseDelay;
        }

        // Add random jitter: baseDelay * (1 ± jitterFactor)
        const jitterAmount = baseDelay * this.jitterFactor;
        const randomJitter = (Math.random() * 2 - 1) * jitterAmount;

        return Math.max(0, baseDelay + randomJitter);
    }

    /**
     * Apply throttling with optional jitter
     */
    private async throttle(): Promise<void> {
        if (!this.requestDelay) return;

        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.requestDelay) {
            const remainingDelay = this.requestDelay - timeSinceLastRequest;
            const actualDelay = this.calculateDelay(remainingDelay);
            await this.sleep(actualDelay);
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Sleep for a specified duration
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Wrapper for API calls with rate limiting and throttling
     */
    private async executeWithRateLimiting<T>(fn: () => Promise<T>, estimatedTokens: number = 0): Promise<T> {
        await this.throttle();

        if (this.requestsPerMinute || this.tokensPerMinute) {
            await this.waitForRateLimit(estimatedTokens);
            this.recordRequest(estimatedTokens);
        }

        return fn();
    }
}