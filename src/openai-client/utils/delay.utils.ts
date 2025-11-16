/**
 * Utility for calculating delays with optional jitter
 */
export class DelayUtils {
    /**
     * Calculate delay with optional jitter
     * @param baseDelay - The base delay in milliseconds
     * @param useJitter - Whether to add jitter to the delay
     * @param jitterFactor - The jitter factor (0-1), representing the percentage of baseDelay to use for jitter
     * @returns The calculated delay in milliseconds
     */
    static calculateDelayWithJitter(
        baseDelay: number,
        useJitter: boolean = true,
        jitterFactor: number = 0.3
    ): number {
        if (!useJitter) {
            return baseDelay;
        }

        // Add random jitter: baseDelay * (1 ± jitterFactor)
        const jitterAmount = baseDelay * jitterFactor;
        const randomJitter = (Math.random() * 2 - 1) * jitterAmount;

        return Math.max(0, baseDelay + randomJitter);
    }

    /**
     * Sleep for a specified duration
     * @param ms - Milliseconds to sleep
     */
    static sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Calculate exponential backoff delay with optional jitter
     * @param attempt - The attempt number (0-indexed)
     * @param baseDelay - The base delay in milliseconds
     * @param maxDelay - The maximum delay cap in milliseconds
     * @param useJitter - Whether to add jitter to the delay
     * @param jitterFactor - The jitter factor for randomization (typically 0.25 = 25%)
     * @returns The calculated delay in milliseconds
     */
    static calculateExponentialBackoff(
        attempt: number,
        baseDelay: number,
        maxDelay: number,
        useJitter: boolean = true,
        jitterFactor: number = 0.25
    ): number {
        // Exponential backoff: baseDelay * 2^attempt
        const exponentialDelay = baseDelay * Math.pow(2, attempt);

        // Cap at maxDelay
        const cappedDelay = Math.min(exponentialDelay, maxDelay);

        if (!useJitter) {
            return cappedDelay;
        }

        // Add jitter (random value between 0 and jitterFactor% of the delay)
        const jitter = Math.random() * jitterFactor * cappedDelay;

        return Math.floor(cappedDelay + jitter);
    }
}