
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
    registeredHandler(error)
  } else {

  }
}

export function isAuthErrorHandlerRegistered(): boolean {
  return registeredHandler !== null
}
