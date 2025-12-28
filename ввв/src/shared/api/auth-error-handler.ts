
export interface AuthError {
  status: number
  message: string
  response?: any
}

export type AuthErrorHandler = (error: AuthError) => void

let registeredHandler: AuthErrorHandler | null = null

export function registerAuthErrorHandler(handler: AuthErrorHandler): () => void {
  registeredHandler = handler

  return () => {
    if (registeredHandler === handler) {
      registeredHandler = null
    }
  }
}

export function handleAuthError(error: AuthError): void {
  if (registeredHandler) {
    console.info(`[AuthErrorHandler] Handler registered, calling handler for ${error.status}: ${error.message}`)
    registeredHandler(error)
  } else {
    console.warn(`[AuthErrorHandler] No handler registered for auth error ${error.status}: ${error.message}. User may not be redirected to login.`)
  }
}

export function isAuthErrorHandlerRegistered(): boolean {
  return registeredHandler !== null
}
