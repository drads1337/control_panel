/**
 * Enhanced centralized API client
 * Provides request batching, centralized error handling, and monitoring integration
 * 
 * SECURITY: This client automatically sanitizes user input before sending to the API
 * to prevent XSS attacks. See src/lib/sanitization.ts and docs/CLIENT_SANITIZATION.md
 * for details. Note that client-side sanitization is defense-in-depth only;
 * all data must be validated and sanitized on the backend as well.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { handleAuthError } from './auth-error-handler'
import { parseErrorResponse, type ApiErrorResponse } from './error-schemas'
import { getApiBaseUrl } from '@/lib/utils'

// API Configuration
const isDevelopment = import.meta.env.DEV
export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  HEADERS: {
    'Content-Type': 'application/json',
  },
  // Request batching configuration
  BATCHING: {
    enabled: true,
    delay: 50, // ms - batch requests within this window
    maxBatchSize: 10, // max requests per batch
  },
} as const

/**
 * Request batching queue
 */
interface QueuedRequest {
  id: string
  config: InternalAxiosRequestConfig
  resolve: (value: any) => void
  reject: (error: any) => void
  timestamp: number
}

class RequestBatcher {
  private queue: QueuedRequest[] = []
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private axiosInstance: AxiosInstance | null = null

  constructor(
    private delay: number = API_CONFIG.BATCHING.delay,
    axiosInstance?: AxiosInstance
  ) {
    this.axiosInstance = axiosInstance || null
  }

  setAxiosInstance(instance: AxiosInstance): void {
    this.axiosInstance = instance
  }

  /**
   * Queue a request for batching (if enabled)
   * Only batches GET requests that can be safely batched
   */
  queueRequest(request: QueuedRequest): void {
    // Only batch GET requests
    if (request.config.method?.toUpperCase() !== 'GET') {
      // Execute immediately for non-GET requests
      this.executeRequest(request)
      return
    }

    this.queue.push(request)

    // If batch is full, execute immediately
    if (this.queue.length >= API_CONFIG.BATCHING.maxBatchSize) {
      this.flushBatch()
      return
    }

    // Set timer to flush batch after delay
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch()
      }, this.delay)
    }
  }

  private flushBatch(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    const requests = [...this.queue]
    this.queue = []

    // Execute all queued requests
    requests.forEach(request => this.executeRequest(request))
  }

  private async executeRequest(request: QueuedRequest): Promise<void> {
    try {
      // Use the axios instance passed to constructor
      if (!this.axiosInstance) {
        // Fallback to direct axios if instance not set (shouldn't happen)
        const axios = await import('axios')
        const response = await axios.default.request(request.config)
        request.resolve(response)
      } else {
        const response = await this.axiosInstance.request(request.config)
        request.resolve(response)
      }
    } catch (error) {
      request.reject(error)
    }
  }

  /**
   * Cancel all queued requests
   */
  cancelAll(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    this.queue.forEach(request => {
      request.reject(new Error('Request cancelled'))
    })

    this.queue = []
  }
}

// Will be initialized after enhancedApi is created
let requestBatcher: RequestBatcher | null = null

/**
 * Check if an error is an authentication error (should trigger logout)
 * vs an authorization error (insufficient permissions, should not logout)
 * 
 * Authentication errors: Invalid token, expired session
 * Authorization errors: Insufficient permissions, permission required
 * CSRF errors: Handled separately - clear cache and retry, don't logout
 */
function isAuthenticationError(status: number, errorData?: any): boolean {
  // 401 is always an authentication error
  if (status === 401) {
    return true
  }

  // For 403, check the error message to distinguish auth vs authorization
  if (status === 403) {
    const errorMessage = (errorData?.error || errorData?.message || '').toLowerCase()
    
    // CSRF errors are handled separately in the CSRF error handler above
    // Don't treat as authentication errors to avoid unnecessary logout
    // CSRF errors can be recovered by fetching a new token
    if (errorMessage.includes('csrf') || errorMessage === 'csrf_error') {
      return false
    }
    
    // Invalid token, authentication required are auth errors
    if (
      errorMessage.includes('invalid token') ||
      errorMessage.includes('authentication required') ||
      errorMessage.includes('unauthorized')
    ) {
      return true
    }
    
    // Note: Generic "token" check removed - too broad, might catch non-auth errors
    
    // Insufficient permissions, permission required are authorization errors (NOT auth errors)
    // Check for specific authorization error patterns
    if (
      errorMessage.includes('insufficient permissions') ||
      (errorMessage.includes('permission') && (errorMessage.includes('required') || errorMessage.includes('denied'))) ||
      errorMessage.includes('access denied')
    ) {
      return false
    }
    
    // Default: treat 403 as potentially an auth error if we can't determine
    // But be conservative - if it's clearly not an auth error, return false
    return false
  }

  return false
}

/**
 * Enhanced error handler with monitoring integration
 */
async function handleError(error: AxiosError): Promise<never> {
  const config = error.config as InternalAxiosRequestConfig | undefined
  
  // Don't handle errors for webhooks endpoints - let them handle errors
  const isWebhooksEndpoint = config?.url?.includes('/api/webhooks/')
  
  // Integrate with monitoring service (Sentry will be added separately)
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    // Dynamic import to avoid bundling in dev
    import('@/lib/monitoring').then(({ captureException }) => {
      captureException(error, {
        context: {
          url: config?.url,
          method: config?.method,
          status: error.response?.status,
          data: error.response?.data,
        },
      })
    }).catch(() => {
      // Monitoring not available - ignore
    })
  }

  // Handle CSRF errors centrally
  if (error.response?.status === 403) {
    try {
      const { isCsrfError, handleCsrfError } = await import('@/lib/csrf')
      if (isCsrfError(error.response.status, error.response.data)) {
        // CSRF errors are handled separately - clear cache and let user retry
        // Don't treat as auth error to avoid unnecessary logout
        await handleCsrfError(error.response.data)
        return Promise.reject(error)
      }
    } catch (csrfError) {
      // If CSRF error handling fails, still return early to avoid treating as auth error
      console.warn('Failed to handle CSRF error in interceptor:', csrfError)
      return Promise.reject(error)
    }
  }

  // Handle authentication errors (401/403 that are actually auth errors)
  // Note: CSRF errors are already handled above and should not reach here
  if (error.response?.status === 401 || error.response?.status === 403) {
    const errorData = error.response?.data as any
    const errorMessage = errorData?.error || errorData?.message || ''
    
    // Skip CSRF errors - they're already handled above
    if (errorMessage.includes('CSRF') || errorMessage === 'CSRF_ERROR') {
      return Promise.reject(error)
    }
    
    // Skip logging expected "Static roles cannot manage RBAC" error
    // This is expected behavior for users with static roles (owner/admin)
    if (errorMessage.includes('Static roles cannot manage RBAC')) {
      // Silently skip - this is expected behavior, not an actual error
      return Promise.reject(error)
    }

    // Check if this is an authentication error (should logout) vs authorization error (should not logout)
    const isAuthError = isAuthenticationError(error.response.status, errorData)
    
    if (isAuthError) {
      console.error('Auth error:', error.response?.data)

      const isManagementPage = window.location.pathname === '/management-page'

      if (!isWebhooksEndpoint && !isManagementPage) {
        handleAuthError({
          status: error.response?.status || 401,
          message: errorData?.message || 'Unauthorized access',
          response: errorData
        })
      }
    } else {
      // Authorization error (insufficient permissions) - don't logout, just show error
      // This is expected behavior when user doesn't have permission for a specific resource
      console.warn('Authorization error (insufficient permissions):', error.response?.data)
    }
  }

  // Handle rate limiting (429)
  if (error.response?.status === 429) {
    const retryAfter = error.response?.headers?.['retry-after'] || error.response?.headers?.['Retry-After']
    const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : null

    import('@/lib/global-notifications').then(({ showGlobalWarning }) => {
      const message = retryAfterSeconds
        ? `Too many requests. Please wait ${retryAfterSeconds} seconds before trying again.`
        : 'Too many requests. Please wait a moment before trying again. The request will be retried automatically with exponential backoff.'

      showGlobalWarning(
        'Rate Limit Exceeded',
        message,
        8000
      )
    }).catch(() => {
      // Notification system not available
    })
  }

  // Handle project expiration errors (402, 410)
  if (error.response?.status === 402 || error.response?.status === 410) {
    import('@/lib/global-notifications').then(({ triggerProjectExpiration }) => {
      triggerProjectExpiration(error.response!.status, error.response!.data)
    }).catch(() => {
      // Notification system not available
    })
  }

  // Handle all other errors with global notifications
  if (!isWebhooksEndpoint) {
    const status = error.response?.status
    const message = (error.response?.data as any)?.message || error.message || 'An unexpected error occurred'

    import('@/lib/global-notifications').then(({ showGlobalError }) => {
      if (status && status >= 500) {
        showGlobalError(
          'Server Error',
          `Server error (${status}): ${message}`,
          5000
        )
      } else if (status && status >= 400 && status !== 401 && status !== 402 && status !== 403 && status !== 410 && status !== 429) {
        showGlobalError(
          'Request Error',
          `Request failed (${status}): ${message}`,
          5000
        )
      } else if (!error.response) {
        showGlobalError(
          'Network Error',
          'Unable to connect to the server. Please check your internet connection.',
          5000
        )
      }
    }).catch(() => {
      // Notification system not available
      console.error('API Error:', {
        status,
        message,
        url: config?.url,
        method: config?.method,
      })
    })
  }

  return Promise.reject(error)
}

/**
 * Enhanced axios instance with centralized configuration
 */
export const enhancedApi: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: API_CONFIG.HEADERS,
  withCredentials: true, // Include httpOnly cookies
})

// Initialize request batcher with the axios instance
requestBatcher = new RequestBatcher(API_CONFIG.BATCHING.delay, enhancedApi)

// Request interceptor
enhancedApi.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Add CSRF token for all requests
    try {
      const { getCsrfHeaders } = await import('@/lib/csrf')
      const csrfHeaders = await getCsrfHeaders()
      Object.assign(config.headers, csrfHeaders)
    } catch (error) {
      console.warn('Failed to add CSRF token to request:', error)
    }

    // Handle FormData - remove Content-Type header so axios can set it with boundary
    if (config.data instanceof FormData) {
      // Delete Content-Type header to let axios set it automatically with boundary
      // This is critical for multipart/form-data uploads
      delete config.headers['Content-Type']
    }

    // Sanitize user input before sending to API (defense-in-depth against XSS)
    // Only sanitize data for methods that send data (POST, PUT, PATCH)
    // Skip sanitization for FormData, File, Blob as they are handled differently
    const method = config.method?.toUpperCase()
    if (method && ['POST', 'PUT', 'PATCH'].includes(method) && config.data) {
      try {
        // Skip sanitization for FormData, File, Blob - backend should handle these
        if (
          config.data instanceof FormData ||
          config.data instanceof File ||
          config.data instanceof Blob
        ) {
          // FormData and File/Blob are handled by backend, skip client-side sanitization
        } else {
          // Sanitize the data payload
          const { sanitizeForApi } = await import('@/lib/sanitization')
          config.data = sanitizeForApi(config.data)
        }
      } catch (error) {
        // If sanitization fails, log but don't break the request
        // Backend validation should catch any issues
        console.warn('[API Client] Failed to sanitize request data:', error)
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
enhancedApi.interceptors.response.use(
  (response) => response,
  handleError
)

/**
 * Helper function to get full API URL
 */
export function getApiUrl(endpoint: string): string {
  return isDevelopment ? endpoint : `${API_CONFIG.BASE_URL}${endpoint}`
}

/**
 * Helper function to get auth headers
 * Note: With httpOnly cookies, authentication is handled automatically
 */
export function getAuthHeaders(token?: string): Record<string, string> {
  return {
    ...API_CONFIG.HEADERS,
  }
}

/**
 * Create a more informative error message for users
 * 
 * Uses Zod schemas to safely parse and access error response data with full type safety.
 * This provides better security and reliability compared to optional chaining (data?.message || data?.error).
 * 
 * @param error - The error object (AxiosError, Error, or unknown)
 * @returns User-friendly error message string
 * 
 * @example
 * ```ts
 * try {
 *   await api.post('/api/users', data)
 * } catch (error) {
 *   toast.error(getErrorMessage(error))
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>
    
    if (axiosError.response) {
      const { status, data } = axiosError.response
      
      // Parse error response using Zod schema for type-safe access
      const parsedError = parseErrorResponse(data)
      
      // Extract message with fallback priority: message -> msg -> error -> default
      const getMessage = (err: ApiErrorResponse | null): string | null => {
        if (!err) return null
        
        // Handle different error response structures
        if ('message' in err && err.message) {
          return err.message
        }
        
        if ('msg' in err && err.msg) {
          return err.msg
        }
        
        if ('error' in err && err.error) {
          return err.error
        }
        
        return null
      }
      
      const errorMessage = getMessage(parsedError)
      
      // Provide user-friendly messages based on status code
      switch (status) {
        case 400:
          return errorMessage || 'Invalid request. Please check your input and try again.'
        case 401:
          // For auth errors, prefer the parsed message but provide a default
          return errorMessage || 'Your session has expired. Please log in again.'
        case 403:
          // Check if it's a CSRF error
          if (parsedError && 'error' in parsedError && parsedError.error === 'CSRF_ERROR') {
            return errorMessage || 'CSRF token missing or invalid. Please refresh the page and try again.'
          }
          return errorMessage || 'You don\'t have permission to perform this action.'
        case 404:
          return errorMessage || 'The requested resource was not found.'
        case 409:
          return errorMessage || 'A conflict occurred. This may be because the resource already exists.'
        case 429:
          // Rate limit errors may include specific limit information
          return errorMessage || 'Too many requests. Please wait a moment and try again.'
        case 500:
          return errorMessage || 'A server error occurred. Our team has been notified. Please try again later.'
        case 502:
        case 503:
        case 504:
          return 'The service is temporarily unavailable. Please try again later.'
        default:
          return errorMessage || `Request failed with status ${status}`
      }
    }

    if (axiosError.request) {
      return 'Unable to connect to the server. Please check your internet connection and try again.'
    }

    return axiosError.message || 'An unexpected error occurred'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred'
}

/**
 * Export the enhanced API client as the default
 * This ensures all API requests use the centralized client
 */
export default enhancedApi

