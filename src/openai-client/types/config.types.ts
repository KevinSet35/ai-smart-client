import { OpenAIModel } from "../config/model-registry";

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
    /** Enable retry logic with exponential backoff. Defaults to true */
    enableRetry?: boolean;
    /** Maximum number of retry attempts. Defaults to 3 */
    maxRetryAttempts?: number;
    /** Base delay in milliseconds for exponential backoff. Defaults to 1000 (1s) */
    baseRetryDelay?: number;
    /** Maximum delay in milliseconds for exponential backoff. Defaults to 60000 (60s) */
    maxRetryDelay?: number;
}