/**
 * Sentry configuration and performance measurement utilities
 */

import { isAxiosError, getErrorStatus } from './utils/error-utils'

/**
 * Measures the performance of an async operation and optionally sends metrics to Sentry
 * 
 * @param operationName - Name of the operation being measured
 * @param fn - Async function to execute and measure
 * @param tags - Optional metadata/tags to include with the measurement
 * @returns The result of the function execution
 */
export async function measurePerformance<T>(
  operationName: string,
  fn: () => Promise<T>,
  tags?: Record<string, any>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    
    // Log performance metric (can be extended to send to Sentry if configured)
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Performance] ${operationName} took ${duration.toFixed(2)}ms`, tags);
    }
    
    // If Sentry is configured, you can add metrics here
    // Example: Sentry.metrics.distribution(operationName, duration, { tags });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Check if this is an expected authentication error (401) that might occur during initialization
    const status = getErrorStatus(error);
    const isAuthError = status === 401;
    
    // Only log unexpected errors or non-auth errors in development
    // Auth errors during initialization are expected and shouldn't clutter the console
    if (process.env.NODE_ENV === 'development' && !isAuthError) {
      console.error(`[Performance] ${operationName} failed after ${duration.toFixed(2)}ms`, { error, tags });
    } else if (process.env.NODE_ENV === 'development' && isAuthError) {
      // Log auth errors at debug level instead of error level
      console.debug(`[Performance] ${operationName} failed with auth error after ${duration.toFixed(2)}ms (expected during initialization)`, { tags });
    }
    
    // Re-throw the error
    throw error;
  }
}

