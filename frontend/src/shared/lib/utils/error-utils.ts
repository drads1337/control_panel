/**
 * Error handling utilities
 */

import type { AxiosError } from 'axios'

/**
 * Check if error is an Axios error
 */
export function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError?: boolean }).isAxiosError === true
  )
}

/**
 * Check if error has a message property
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  )
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>
    const errorData = axiosError.response?.data

    if (errorData && typeof errorData === 'object') {
      if ('message' in errorData && typeof errorData.message === 'string') {
        return errorData.message
      }
      if ('error' in errorData && typeof errorData.error === 'string') {
        return errorData.error
      }
    }

    if (axiosError.message) {
      return axiosError.message
    }
  }

  if (isErrorWithMessage(error)) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'An unexpected error occurred'
}

/**
 * Extract HTTP status code from error
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (isAxiosError(error)) {
    return error.response?.status
  }
  return undefined
}

