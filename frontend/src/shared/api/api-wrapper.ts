/**
 * Centralized API wrapper for consistent error handling
 * 
 * This module provides a unified way to handle API calls with:
 * - Automatic error extraction and formatting
 * - Consistent error handling patterns
 * - Support for special status codes (402, 429, etc.)
 * 
 * @example
 * ```ts
 * import { apiCall } from '@/lib/api/api-wrapper'
 * 
 * export const getProducts = () => apiCall(
 *   () => api.get(API_ENDPOINTS.PRODUCTS),
 *   { extractData: (res) => res.data }
 * )
 * ```
 */

import type { AxiosResponse } from 'axios'
import { getErrorMessage, getErrorStatus, isAxiosError } from '@/lib/utils/error-utils'

export interface ApiCallOptions<T = unknown> {
  /**
   * Function to extract data from response
   * Default: (res) => res.data
   */
  extractData?: (response: AxiosResponse) => T
  
  /**
   * Custom error handler
   * If provided, will be called before default error handling
   */
  onError?: (error: unknown) => void
  
  /**
   * Whether to handle special status codes (402, 429) automatically
   * Default: true
   */
  handleSpecialStatusCodes?: boolean
  
  /**
   * Custom error message
   */
  errorMessage?: string
}

/**
 * Wrapper for API calls with consistent error handling
 * 
 * @param apiCall - Function that returns a promise (usually axios call)
 * @param options - Options for error handling and data extraction
 * @returns Promise with extracted data
 * @throws Error with formatted message
 */
export async function apiCall<T = unknown>(
  apiCall: () => Promise<AxiosResponse<T>>,
  options: ApiCallOptions<T> = {}
): Promise<T> {
  const {
    extractData = (res) => res.data as T,
    onError,
    handleSpecialStatusCodes = true,
    errorMessage,
  } = options

  try {
    const response = await apiCall()
    return extractData(response)
  } catch (error: unknown) {
    // Call custom error handler if provided
    if (onError) {
      onError(error)
    }

    // Handle special status codes if enabled
    if (handleSpecialStatusCodes) {
      const status = getErrorStatus(error)
      
      if (status === 402) {
        const paymentError = new Error('PAYMENT REQUIRED')
        ;(paymentError as { status?: number; data?: unknown }).status = 402
        if (isAxiosError(error)) {
          ;(paymentError as { status?: number; data?: unknown }).data = error.response?.data
        }
        throw paymentError
      }
      
      if (status === 429) {
        const rateLimitError = new Error('TOO MANY REQUESTS')
        ;(rateLimitError as { status?: number }).status = 429
        throw rateLimitError
      }
    }

    // Throw formatted error
    const message = errorMessage || getErrorMessage(error)
    throw new Error(message)
  }
}

/**
 * Wrapper for API calls that need custom error data extraction
 * Extracts error message from response.data.error if available
 * 
 * @param apiCall - Function that returns a promise
 * @param options - Options for error handling
 * @returns Promise with response data
 */
export async function apiCallWithErrorData<T = unknown>(
  apiCall: () => Promise<AxiosResponse<T>>,
  options: ApiCallOptions<T> = {}
): Promise<T> {
  try {
    const response = await apiCall()
    return options.extractData ? options.extractData(response) : (response.data as T)
  } catch (error: unknown) {
    // Extract error data from response if available
    if (isAxiosError(error) && error.response?.data) {
      const errorData = error.response.data
      if (typeof errorData === 'object' && errorData !== null && 'error' in errorData) {
        const errorMessage = typeof errorData.error === 'string' 
          ? errorData.error 
          : getErrorMessage(error)
        throw new Error(errorMessage)
      }
    }
    
    // Call custom error handler if provided
    if (options.onError) {
      options.onError(error)
    }

    // Handle special status codes if enabled
    if (options.handleSpecialStatusCodes !== false) {
      const status = getErrorStatus(error)
      
      if (status === 402) {
        const paymentError = new Error('PAYMENT REQUIRED')
        ;(paymentError as { status?: number; data?: unknown }).status = 402
        if (isAxiosError(error)) {
          ;(paymentError as { status?: number; data?: unknown }).data = error.response?.data
        }
        throw paymentError
      }
      
      if (status === 429) {
        const rateLimitError = new Error('TOO MANY REQUESTS')
        ;(rateLimitError as { status?: number }).status = 429
        throw rateLimitError
      }
    }

    // Throw formatted error
    const message = options.errorMessage || getErrorMessage(error)
    throw new Error(message)
  }
}


