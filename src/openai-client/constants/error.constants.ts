/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
} as const;

/**
 * Error keywords for classification
 */
export const ERROR_KEYWORDS = {
    RATE_LIMIT: "rate limit",
    TIMEOUT: "timeout",
    TIMED_OUT: "timed out",
    NETWORK: "network",
    NETWORK_ERROR: "network error",
    SCHEMA_MISMATCH: "does not match expected schema",
    API: "API",
    ECONNREFUSED: "ECONNREFUSED",
    ENOTFOUND: "ENOTFOUND",
    ETIMEDOUT: "ETIMEDOUT",
    ECONNRESET: "ECONNRESET",
} as const;

/**
 * HTTP status code strings (for error message matching)
 */
export const HTTP_STATUS_STRINGS = {
    BAD_REQUEST: "400",
    UNAUTHORIZED: "401",
    FORBIDDEN: "403",
    NOT_FOUND: "404",
    TOO_MANY_REQUESTS: "429",
    INTERNAL_SERVER_ERROR: "500",
    BAD_GATEWAY: "502",
    SERVICE_UNAVAILABLE: "503",
    GATEWAY_TIMEOUT: "504",
} as const;

/**
 * Default error messages
 */
export const DEFAULT_ERROR_MESSAGES = {
    UNKNOWN: "An unknown error occurred",
} as const;