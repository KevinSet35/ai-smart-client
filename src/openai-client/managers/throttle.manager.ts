import { DelayUtils } from "../utils/delay.utils";

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
            const actualDelay = DelayUtils.calculateDelayWithJitter(
                remainingDelay,
                this.useJitter,
                this.jitterFactor
            );
            await DelayUtils.sleep(actualDelay);
        }

        this.lastRequestTime = Date.now();
    }
}