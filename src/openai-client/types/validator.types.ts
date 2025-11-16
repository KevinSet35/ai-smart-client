/**
 * Return type for retry settings validation
 */
export interface ValidatedRetrySettings {
    enabled: boolean;
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
}

/**
 * Return type for throttle settings validation
 */
export interface ValidatedThrottleSettings {
    requestDelay?: number;
    useJitter: boolean;
    jitterFactor: number;
}

/**
 * Return type for rate limit validation
 */
export interface ValidatedRateLimits {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
}