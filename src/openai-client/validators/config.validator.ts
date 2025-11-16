import { OPENAI_MODEL_REGISTRY, OpenAIModel } from "../config/model-registry";
import { OpenAIClientConfig } from "../types/config.types";

export class ConfigValidator {
    // API Key Configuration
    private readonly OPENAI_API_KEY_PREFIX = "sk-";

    // Client Configuration Defaults
    private readonly DEFAULT_TIMEOUT_MS = 60000;
    private readonly DEFAULT_MAX_RETRIES = 2;

    // Temperature Configuration
    private readonly DEFAULT_TEMPERATURE = 0.7;
    private readonly MIN_TEMPERATURE = 0;
    private readonly MAX_TEMPERATURE = 2;

    // Token Configuration
    private readonly MIN_MAX_TOKENS = 1;

    // Rate Limiting Configuration
    private readonly MIN_REQUESTS_PER_MINUTE = 1;
    private readonly MIN_TOKENS_PER_MINUTE = 1;

    // Request Delay Configuration
    private readonly MIN_REQUEST_DELAY_MS = 0;

    // Jitter Configuration
    private readonly DEFAULT_USE_JITTER = true;
    private readonly DEFAULT_JITTER_FACTOR = 0.3;
    private readonly MIN_JITTER_FACTOR = 0;
    private readonly MAX_JITTER_FACTOR = 1;

    // Retry Configuration
    private readonly DEFAULT_ENABLE_RETRY = true;
    private readonly DEFAULT_MAX_RETRY_ATTEMPTS = 3;
    private readonly DEFAULT_BASE_RETRY_DELAY_MS = 1000;
    private readonly DEFAULT_MAX_RETRY_DELAY_MS = 60000;
    private readonly MIN_RETRY_ATTEMPTS = 1;
    private readonly MAX_RETRY_ATTEMPTS = 10;
    private readonly MIN_BASE_RETRY_DELAY_MS = 100;
    private readonly MAX_BASE_RETRY_DELAY_MS = 10000;

    /**
     * Validate and get the API key
     */
    validateApiKey(apiKey?: string): string {
        const key = apiKey ?? process.env.OPENAI_API_KEY;

        if (!key) {
            throw new Error(
                "OpenAI API key not found. Provide it via:\n" +
                "1. OpenAIClient({ apiKey: '...' })\n" +
                "2. OPENAI_API_KEY environment variable"
            );
        }

        if (!key.startsWith(this.OPENAI_API_KEY_PREFIX)) {
            throw new Error(
                `Invalid OpenAI API key format. API keys should start with '${this.OPENAI_API_KEY_PREFIX}'`
            );
        }

        return key;
    }

    /**
     * Validate and get the model
     */
    validateModel(model?: OpenAIModel): OpenAIModel {
        const validatedModel = model ?? OpenAIModel.GPT_4O;

        const isValidModel = Object.values(OpenAIModel).includes(validatedModel);
        if (!isValidModel) {
            const validModels = Object.values(OpenAIModel).join(", ");
            throw new Error(`Invalid model: "${validatedModel}". Must be one of: ${validModels}`);
        }

        return validatedModel;
    }

    /**
     * Validate and get the temperature
     */
    validateTemperature(temperature?: number): number {
        const validatedTemperature = temperature ?? this.DEFAULT_TEMPERATURE;

        if (typeof validatedTemperature !== "number" || isNaN(validatedTemperature)) {
            throw new Error("Temperature must be a valid number");
        }

        if (validatedTemperature < this.MIN_TEMPERATURE || validatedTemperature > this.MAX_TEMPERATURE) {
            throw new Error(`Temperature must be between ${this.MIN_TEMPERATURE} and ${this.MAX_TEMPERATURE}`);
        }

        return validatedTemperature;
    }

    /**
     * Validate and get max tokens
     */
    validateMaxTokens(maxTokens: number | undefined, defaultModel: OpenAIModel): number | undefined {
        if (maxTokens === undefined) {
            return undefined;
        }

        if (typeof maxTokens !== "number" || isNaN(maxTokens) || maxTokens < this.MIN_MAX_TOKENS) {
            throw new Error(`maxTokens must be a positive number (at least ${this.MIN_MAX_TOKENS})`);
        }

        const modelMetadata = OPENAI_MODEL_REGISTRY[defaultModel];
        if (maxTokens > modelMetadata.contextWindow) {
            throw new Error(`maxTokens (${maxTokens}) exceeds model's context window (${modelMetadata.contextWindow})`);
        }

        return maxTokens;
    }

    /**
     * Validate and get system message
     */
    validateSystemMessage(systemMessage?: string): string | undefined {
        if (systemMessage === undefined) {
            return undefined;
        }

        if (typeof systemMessage !== "string") {
            throw new Error("System message must be a string");
        }

        if (systemMessage.trim().length === 0) {
            throw new Error("System message cannot be empty or whitespace only");
        }

        return systemMessage;
    }

    /**
     * Validate rate limiting configuration
     */
    validateRateLimits(rateLimit?: OpenAIClientConfig["rateLimit"]): {
        requestsPerMinute?: number;
        tokensPerMinute?: number;
    } {
        const result: { requestsPerMinute?: number; tokensPerMinute?: number } = {};

        if (!rateLimit) return result;

        if (rateLimit.requestsPerMinute !== undefined) {
            if (rateLimit.requestsPerMinute < this.MIN_REQUESTS_PER_MINUTE) {
                throw new Error(`requestsPerMinute must be at least ${this.MIN_REQUESTS_PER_MINUTE}`);
            }
            result.requestsPerMinute = rateLimit.requestsPerMinute;
        }

        if (rateLimit.tokensPerMinute !== undefined) {
            if (rateLimit.tokensPerMinute < this.MIN_TOKENS_PER_MINUTE) {
                throw new Error(`tokensPerMinute must be at least ${this.MIN_TOKENS_PER_MINUTE}`);
            }
            result.tokensPerMinute = rateLimit.tokensPerMinute;
        }

        return result;
    }

    /**
     * Validate throttle settings
     */
    validateThrottleSettings(
        requestDelay?: number,
        useJitter?: boolean,
        jitterFactor?: number
    ): {
        requestDelay?: number;
        useJitter: boolean;
        jitterFactor: number;
    } {
        let validatedRequestDelay: number | undefined = undefined;

        if (requestDelay !== undefined) {
            if (requestDelay < this.MIN_REQUEST_DELAY_MS) {
                throw new Error(`requestDelay must be non-negative (at least ${this.MIN_REQUEST_DELAY_MS}ms)`);
            }
            validatedRequestDelay = requestDelay;
        }

        const validatedUseJitter = useJitter ?? this.DEFAULT_USE_JITTER;
        const validatedJitterFactor = jitterFactor ?? this.DEFAULT_JITTER_FACTOR;

        if (validatedJitterFactor < this.MIN_JITTER_FACTOR || validatedJitterFactor > this.MAX_JITTER_FACTOR) {
            throw new Error(
                `jitterFactor must be between ${this.MIN_JITTER_FACTOR} and ${this.MAX_JITTER_FACTOR}`
            );
        }

        return {
            requestDelay: validatedRequestDelay,
            useJitter: validatedUseJitter,
            jitterFactor: validatedJitterFactor,
        };
    }

    /**
     * Get default timeout
     */
    getDefaultTimeout(): number {
        return this.DEFAULT_TIMEOUT_MS;
    }

    /**
     * Get default max retries
     */
    getDefaultMaxRetries(): number {
        return this.DEFAULT_MAX_RETRIES;
    }

    /**
     * Validate retry settings
     */
    validateRetrySettings(
        enableRetry?: boolean,
        maxRetryAttempts?: number,
        baseRetryDelay?: number,
        maxRetryDelay?: number
    ): {
        enabled: boolean;
        maxAttempts: number;
        baseDelay: number;
        maxDelay: number;
    } {
        const enabled = enableRetry ?? this.DEFAULT_ENABLE_RETRY;
        const maxAttempts = maxRetryAttempts ?? this.DEFAULT_MAX_RETRY_ATTEMPTS;
        const baseDelay = baseRetryDelay ?? this.DEFAULT_BASE_RETRY_DELAY_MS;
        const maxDelay = maxRetryDelay ?? this.DEFAULT_MAX_RETRY_DELAY_MS;

        if (maxAttempts < this.MIN_RETRY_ATTEMPTS || maxAttempts > this.MAX_RETRY_ATTEMPTS) {
            throw new Error(
                `maxRetryAttempts must be between ${this.MIN_RETRY_ATTEMPTS} and ${this.MAX_RETRY_ATTEMPTS}`
            );
        }

        if (baseDelay < this.MIN_BASE_RETRY_DELAY_MS || baseDelay > this.MAX_BASE_RETRY_DELAY_MS) {
            throw new Error(
                `baseRetryDelay must be between ${this.MIN_BASE_RETRY_DELAY_MS}ms and ${this.MAX_BASE_RETRY_DELAY_MS}ms`
            );
        }

        if (maxDelay < baseDelay) {
            throw new Error("maxRetryDelay must be greater than or equal to baseRetryDelay");
        }

        return {
            enabled,
            maxAttempts,
            baseDelay,
            maxDelay,
        };
    }
}