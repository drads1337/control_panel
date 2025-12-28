
import { isCsrfError, handleCsrfError } from '@/lib/csrf'
import type { AxiosError } from 'axios'

/**
 * Type guard to check if error is an AxiosError
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    'request' in error
  )
}

/**
 * Type guard to check if error has a message property
 */
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  )
}

/**
 * Type guard to check if error has response data
 */
function hasResponseData(
  error: unknown
): error is { response: { data: { error?: string; message?: string } } } {
  return (
    isAxiosError(error) &&
    error.response !== undefined &&
    typeof error.response.data === 'object' &&
    error.response.data !== null
  )
}

export function extractErrorMessage(error: unknown): string {
  if (hasResponseData(error)) {
    if (error.response.data.error) {
      return error.response.data.error
    }
    if (error.response.data.message) {
      return error.response.data.message
    }
  }
  if (isErrorWithMessage(error)) {
    return error.message
  }
  return 'An unexpected error occurred'
}

export async function handleApiError(error: unknown): Promise<never> {
  if (isAxiosError(error)) {
    const status = error.response?.status
    const errorData = error.response?.data

    if (status && isCsrfError(status, errorData)) {
      return handleCsrfError(errorData)
    }
  }

  const message = extractErrorMessage(error)
  throw new Error(message)
}

export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error: unknown) {
      return handleApiError(error)
    }
  }) as T
}
