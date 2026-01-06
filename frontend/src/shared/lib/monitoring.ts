/**
 * Error monitoring utilities
 * Handles exception tracking and error reporting
 */

interface ErrorContext {
  context?: {
    url?: string
    method?: string
    status?: number
    data?: unknown
    [key: string]: unknown
  }
}

/**
 * Captures an exception for monitoring/error tracking
 * In production, this would send the error to an error tracking service (e.g., Sentry)
 * 
 * @param error - The error to capture
 * @param options - Additional context about the error
 */
export function captureException(error: unknown, options?: ErrorContext): void {
  // Only log in development - in production this would send to error tracking service
  if (import.meta.env.DEV) {
    console.error('[Monitoring] Exception captured:', error, options)
    return
  }

  // In production, this would integrate with an error tracking service
  // Example: Sentry.captureException(error, { extra: options?.context })
  
  // For now, silently handle - the error is already being handled by the error handler
  // This prevents double-logging of errors
}










