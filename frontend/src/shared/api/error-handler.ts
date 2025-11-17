/**
 * Centralized error handling for API requests
 * CSRF errors are automatically handled by the axios response interceptor in base.ts
 * This module provides utilities for consistent error handling
 */

import { isCsrfError, handleCsrfError } from '@/lib/csrf'

/**
 * Extract error message from axios error or generic error
 */
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

/**
 * Handle API error - checks for CSRF errors and handles them appropriately
 * Note: CSRF errors should already be handled by axios interceptor, but this provides
 * a fallback for cases where manual error handling is needed
 */
export async function handleApiError(error: any): Promise<never> {
  const status = error?.response?.status
  const errorData = error?.response?.data

  // Handle CSRF errors if they weren't already handled by interceptor
  if (status && isCsrfError(status, errorData)) {
    return handleCsrfError(errorData)
  }

  // Extract and throw error message
  const message = extractErrorMessage(error)
  throw new Error(message)
}

/**
 * Wrapper for API functions that automatically handles errors
 * Use this for consistent error handling across all API calls
 */
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
