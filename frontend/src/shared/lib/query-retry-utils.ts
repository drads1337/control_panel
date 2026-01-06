/**
 * Utility functions for React Query retry logic
 * Provides consistent retry behavior across the application
 */

interface CreateQueryRetryOptions {
  /**
   * Maximum number of retries for non-rate-limit errors
   * @default 2
   */
  maxRetries?: number
  /**
   * Maximum number of retries for rate limit (429) errors
   * @default 0 (don't retry rate limit errors)
   */
  maxRetriesRateLimit?: number
  /**
   * Whether to retry on payment required (402) errors
   * @default false
   */
  retryPaymentErrors?: boolean
}

/**
 * Creates a retry function for React Query that handles common error cases
 * 
 * @param options - Retry configuration options
 * @returns A retry function compatible with React Query's retry option
 */
export function createQueryRetry(options: CreateQueryRetryOptions = {}) {
  const {
    maxRetries = 2,
    maxRetriesRateLimit = 0,
    retryPaymentErrors = false,
  } = options

  return (failureCount: number, error: any): boolean => {
    // Never retry authentication/authorization errors
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      return false
    }

    // Handle rate limit errors (429)
    if (error?.response?.status === 429) {
      return failureCount < maxRetriesRateLimit
    }

    // Handle payment required errors (402)
    if (error?.response?.status === 402) {
      return retryPaymentErrors && failureCount < maxRetries
    }

    // Handle project expiration (410)
    if (error?.response?.status === 410) {
      return false
    }

    // Default: retry up to maxRetries for other errors
    return failureCount < maxRetries
  }
}

