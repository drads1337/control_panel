
import { isCsrfError, handleCsrfError } from '@/lib/csrf'

export function extractErrorMessage(error: any): string {
  if (error?.response?.data?.error) {
    return error.response.data.error
  }
  if (error?.response?.data?.message) {
    return error.response.data.message
  }
  if (error?.message) {
    return error.message
  }
  return 'An unexpected error occurred'
}

export async function handleApiError(error: any): Promise<never> {
  const status = error?.response?.status
  const errorData = error?.response?.data

  if (status && isCsrfError(status, errorData)) {
    return handleCsrfError(errorData)
  }

  const message = extractErrorMessage(error)
  throw new Error(message)
}

export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }) as T
}
