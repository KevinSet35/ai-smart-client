export class RateLimitManager {
    private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
    private readonly THROTTLE_CHECK_INTERVAL_MS = 1000; // 1 second

    private requestTimestamps: number[] = [];
    private tokenTimestamps: Array<{ timestamp: number; tokens: number }> = [];

    constructor(
        private requestsPerMinute?: number,
        private tokensPerMinute?: number
    ) { }

    /**
     * Check if we can make a request based on rate limits
     */
    canMakeRequest(estimatedTokens: number = 0): boolean {
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
     * Record a request for rate limiting
     */
    recordRequest(tokensUsed: number = 0): void {
        const now = Date.now();
        this.requestTimestamps.push(now);

        if (tokensUsed > 0) {
            this.tokenTimestamps.push({ timestamp: now, tokens: tokensUsed });
        }
    }

    /**
     * Wait until we can make a request
     */
    async waitForRateLimit(estimatedTokens: number = 0): Promise<void> {
        while (!this.canMakeRequest(estimatedTokens)) {
            await this.sleep(this.THROTTLE_CHECK_INTERVAL_MS);
        }
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
     * Sleep for a specified duration
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}