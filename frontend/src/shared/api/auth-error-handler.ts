/**
 * Centralized authentication error handler
 * Provides a predictable way to handle auth errors without global events
 */

export interface AuthError {
  status: number
  message: string
  response?: any
}

export type AuthErrorHandler = (error: AuthError) => void

// Store registered handler
let registeredHandler: AuthErrorHandler | null = null

/**
 * Register a handler for authentication errors (401/403)
 * This replaces the passive global event system with a predictable callback approach
 * 
 * @param handler - Function to call when auth error occurs
 * @returns Unregister function
 */
export function registerAuthErrorHandler(handler: AuthErrorHandler): () => void {
  registeredHandler = handler
  
  // Return unregister function
  return () => {
    if (registeredHandler === handler) {
      registeredHandler = null
    }
  }
}

/**
 * Handle authentication error by calling registered handler
 * Called from axios interceptor in base.ts
 * 
 * @param error - Authentication error details
 */
export function handleAuthError(error: AuthError): void {
  if (registeredHandler) {
    registeredHandler(error)
  } else {
    // Fallback: log warning if no handler is registered
    console.warn('Auth error occurred but no handler is registered:', error)
  }
}

/**
 * Check if auth error handler is registered
 */
export function isAuthErrorHandlerRegistered(): boolean {
  return registeredHandler !== null
}

