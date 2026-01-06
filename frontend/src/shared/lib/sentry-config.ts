/**
 * Sentry configuration and performance measurement utilities
 */

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
    
    // Log error with performance data
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Performance] ${operationName} failed after ${duration.toFixed(2)}ms`, { error, tags });
    }
    
    // Re-throw the error
    throw error;
  }
}

