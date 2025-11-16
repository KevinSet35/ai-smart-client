export class ThrottleManager {
    private readonly DEFAULT_JITTER_FACTOR = 0.3;
    private lastRequestTime = 0;

    constructor(
        private requestDelay?: number,
        private useJitter: boolean = true,
        private jitterFactor: number = this.DEFAULT_JITTER_FACTOR
    ) { }

    /**
     * Apply throttling with optional jitter
     */
    async throttle(): Promise<void> {
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
     * Sleep for a specified duration
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}