import { Logger } from "@nestjs/common";
import { HTTP_STATUS, ERROR_KEYWORDS, HTTP_STATUS_STRINGS } from "../constants/error.constants";

export class RetryManager {
    private readonly logger = new Logger(RetryManager.name);

    constructor(
        private readonly enabled: boolean,
        private readonly maxAttempts: number,
        private readonly baseDelay: number,
        private readonly maxDelay: number
    ) { }

    /**
     * Execute a function with retry logic
     */
    async executeWithRetry<T>(
        fn: () => Promise<T>,
        onError: (error: unknown) => T
    ): Promise<T> {
        if (!this.enabled) {
            try {
                return await fn();
            } catch (error) {
                return onError(error);
            }
        }

        let lastError: unknown;

        for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // Check if we should retry
                if (!this.isRetriableError(error)) {
                    this.logger.debug(`Non-retriable error encountered: ${this.getErrorMessage(error)}`);
                    return onError(error);
                }

                // Check if we have attempts left
                if (attempt < this.maxAttempts - 1) {
                    const delay = this.calculateDelay(attempt);
                    this.logger.warn(
                        `Request failed (attempt ${attempt + 1}/${this.maxAttempts}): ${this.getErrorMessage(error)}. Retrying in ${delay}ms...`
                    );
                    await this.sleep(delay);
                } else {
                    this.logger.error(
                        `Request failed after ${this.maxAttempts} attempts: ${this.getErrorMessage(error)}`
                    );
                }
            }
        }

        return onError(lastError);
    }

    /**
     * Determine if an error is retriable
     */
    isRetriableError(error: unknown): boolean {
        const errorMessage = this.getErrorMessage(error);
        const errorCode = this.getErrorCode(error);

        // Rate limit errors - always retry
        if (
            errorCode === HTTP_STATUS.TOO_MANY_REQUESTS ||
            errorMessage.includes(ERROR_KEYWORDS.RATE_LIMIT) ||
            errorMessage.includes(HTTP_STATUS_STRINGS.TOO_MANY_REQUESTS)
        ) {
            return true;
        }

        // Timeout errors - retry
        if (errorMessage.includes(ERROR_KEYWORDS.TIMEOUT) || errorMessage.includes(ERROR_KEYWORDS.TIMED_OUT)) {
            return true;
        }

        // Temporary server errors - retry
        if (
            errorCode === HTTP_STATUS.INTERNAL_SERVER_ERROR ||
            errorCode === HTTP_STATUS.BAD_GATEWAY ||
            errorCode === HTTP_STATUS.SERVICE_UNAVAILABLE ||
            errorCode === HTTP_STATUS.GATEWAY_TIMEOUT
        ) {
            return true;
        }

        if (
            errorMessage.includes(HTTP_STATUS_STRINGS.INTERNAL_SERVER_ERROR) ||
            errorMessage.includes(HTTP_STATUS_STRINGS.BAD_GATEWAY) ||
            errorMessage.includes(HTTP_STATUS_STRINGS.SERVICE_UNAVAILABLE) ||
            errorMessage.includes(HTTP_STATUS_STRINGS.GATEWAY_TIMEOUT)
        ) {
            return true;
        }

        // Network errors - retry
        if (
            errorMessage.includes(ERROR_KEYWORDS.ECONNREFUSED) ||
            errorMessage.includes(ERROR_KEYWORDS.ENOTFOUND) ||
            errorMessage.includes(ERROR_KEYWORDS.ETIMEDOUT) ||
            errorMessage.includes(ERROR_KEYWORDS.ECONNRESET) ||
            errorMessage.includes(ERROR_KEYWORDS.NETWORK_ERROR)
        ) {
            return true;
        }

        // Do NOT retry these errors:
        // - 400 (Bad Request) - client error, won't succeed on retry
        // - 401 (Unauthorized) - invalid API key
        // - 403 (Forbidden) - permission issue
        // - 404 (Not Found) - resource doesn't exist
        // - Validation errors - schema mismatch
        return false;
    }

    /**
     * Calculate exponential backoff delay with jitter
     */
    private calculateDelay(attempt: number): number {
        // Exponential backoff: baseDelay * 2^attempt
        const exponentialDelay = this.baseDelay * Math.pow(2, attempt);

        // Cap at maxDelay
        const cappedDelay = Math.min(exponentialDelay, this.maxDelay);

        // Add jitter (random value between 0 and 25% of the delay)
        const jitter = Math.random() * 0.25 * cappedDelay;

        return Math.floor(cappedDelay + jitter);
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Extract error message from unknown error
     */
    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    /**
     * Extract HTTP status code from error if available
     */
    private getErrorCode(error: unknown): number | null {
        if (error && typeof error === "object" && "status" in error) {
            return error.status as number;
        }
        if (error && typeof error === "object" && "statusCode" in error) {
            return error.statusCode as number;
        }
        return null;
    }
}