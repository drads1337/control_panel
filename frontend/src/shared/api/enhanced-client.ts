
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { handleAuthError } from './auth-error-handler'
import { parseErrorResponse, type ApiErrorResponse } from './error-schemas'
import { getApiBaseUrl } from '@/lib/utils'

/**
 * Interface for API error handlers.
 * Allows the API client to report errors without depending on UI components.
 */
export interface ApiErrorHandlers {
  /**
   * Show a warning notification
   */
  showWarning?: (title: string, message?: string, duration?: number) => void
  
  /**
   * Show an error notification
   */
  showError?: (title: string, message?: string, duration?: number) => void
  
  /**
   * Handle project expiration events (402/410 status codes)
   */
  handleProjectExpiration?: (status: number, data: unknown) => void
}

let errorHandlers: ApiErrorHandlers | null = null

/**
 * Configure error handlers for the API client.
 * This allows the UI layer to inject error handling logic without creating a dependency.
 * 
 * @param handlers - Error handlers to use for API error reporting
 * 
 * @example
 * ```ts
 * import { setApiErrorHandlers } from '@/shared/api/enhanced-client'
 * import { showGlobalError, showGlobalWarning, triggerProjectExpiration } from '@/lib/global-notifications'
 * 
 * setApiErrorHandlers({
 *   showError: showGlobalError,
 *   showWarning: showGlobalWarning,
 *   handleProjectExpiration: triggerProjectExpiration,
 * })
 * ```
 */
export function setApiErrorHandlers(handlers: ApiErrorHandlers | null): void {
  errorHandlers = handlers
}

/**
 * Clear all error handlers.
 * Useful for testing or when switching to a different error handling mechanism.
 */
export function clearApiErrorHandlers(): void {
  errorHandlers = null
}

const isDevelopment = import.meta.env.DEV
export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  HEADERS: {
    'Content-Type': 'application/json',
  },

  BATCHING: {
    enabled: true,
    delay: 50,
    maxBatchSize: 10,
  },
} as const

interface QueuedRequest {
  id: string
  config: InternalAxiosRequestConfig
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
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

  queueRequest(request: QueuedRequest): void {

    if (request.config.method?.toUpperCase() !== 'GET') {

      this.executeRequest(request)
      return
    }

    this.queue.push(request)

    if (this.queue.length >= API_CONFIG.BATCHING.maxBatchSize) {
      this.flushBatch()
      return
    }

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

    requests.forEach(request => this.executeRequest(request))
  }

  private async executeRequest(request: QueuedRequest): Promise<void> {
    try {

      if (!this.axiosInstance) {

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

let requestBatcher: RequestBatcher | null = null

function isAuthenticationError(status: number, errorData?: any): boolean {

  if (status === 401) {
    return true
  }

  if (status === 403) {
    const errorMessage = (errorData?.error || errorData?.message || '').toLowerCase()

    if (errorMessage.includes('csrf') || errorMessage === 'csrf_error') {
      return false
    }

    if (
      errorMessage.includes('invalid token') ||
      errorMessage.includes('authentication required') ||
      errorMessage.includes('unauthorized')
    ) {
      return true
    }

    if (
      errorMessage.includes('insufficient permissions') ||
      (errorMessage.includes('permission') && (errorMessage.includes('required') || errorMessage.includes('denied'))) ||
      errorMessage.includes('access denied')
    ) {
      return false
    }

    return false
  }

  return false
}

async function handleError(error: AxiosError): Promise<never> {
  const config = error.config as InternalAxiosRequestConfig | undefined
  
  // Get URL from config or error config, handling both relative and absolute URLs
  const requestUrl = config?.url || (error.config as InternalAxiosRequestConfig | undefined)?.url || ''
  const fullUrl = config?.baseURL ? `${config.baseURL}${requestUrl}` : requestUrl

  const isWebhooksEndpoint = requestUrl?.includes('/api/webhooks/') || fullUrl?.includes('/api/webhooks/')
  const isCsrfTokenEndpoint = requestUrl?.includes('/api/auth/csrf-token') || fullUrl?.includes('/api/auth/csrf-token')
  const isMeEndpoint = requestUrl?.includes('/api/users/me') || 
                       fullUrl?.includes('/api/users/me') ||
                       requestUrl?.endsWith('/me') ||
                       fullUrl?.endsWith('/me')

  // Check for CSRF-related errors early and silently reject them
  // This includes both response errors and network errors for CSRF token endpoint
  const errorData = error.response?.data
  let isCsrfError = false
  
  // Always treat CSRF token endpoint errors as CSRF errors (even network errors)
  if (isCsrfTokenEndpoint) {
    isCsrfError = true
  } 
  // Also check for CSRF errors in response data
  else if (errorData && typeof errorData === 'object') {
    if ('error' in errorData) {
      const errorCode = String(errorData.error)
      if (errorCode.includes('CSRF') || errorCode === 'CSRF_TOKEN_FAILED' || errorCode === 'CSRF_ERROR') {
        isCsrfError = true
      }
    }
    if (!isCsrfError && 'message' in errorData) {
      const errorMsg = String(errorData.message)
      if (errorMsg.includes('CSRF') || errorMsg.includes('csrf token') || errorMsg.includes('CSRF_TOKEN_FAILED') || 
          errorMsg.includes('No authentication token found')) {
        isCsrfError = true
      }
    }
  }
  // Check error message in the error object itself
  if (!isCsrfError && error.message) {
    const errorMsg = String(error.message)
    if (errorMsg.includes('CSRF') || errorMsg.includes('csrf token') || errorMsg.includes('CSRF_TOKEN_FAILED')) {
      isCsrfError = true
    }
  }
  // Check if this is a CSRF fetch request that failed (network error)
  if (!isCsrfError && !error.response && (config as any)?.['__isCsrfFetch']) {
    isCsrfError = true
  }
  
  // Silently reject all CSRF-related errors - they're expected and not critical
  // This prevents showing error messages to users for expected CSRF failures
  if (isCsrfError) {
    return Promise.reject(error)
  }

  // Don't log or monitor CSRF token endpoint errors - they're expected when not authenticated
  if (!isCsrfTokenEndpoint && import.meta.env.PROD && typeof window !== 'undefined') {

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

    })
  }

  if (error.response?.status === 403) {
    try {
      const { isCsrfError, clearCsrfToken, getCsrfHeaders } = await import('@/lib/csrf')
      if (isCsrfError(error.response.status, error.response.data)) {

        const config = error.config as InternalAxiosRequestConfig | undefined

        const retryCount = (config as any)?.['__csrfRetryCount'] || 0
        if (retryCount === 0 && config) {

          clearCsrfToken()

          ;(config as any)['__csrfRetryCount'] = 1

          try {
            const csrfHeaders = await getCsrfHeaders()
            Object.assign(config.headers, csrfHeaders)

            return enhancedApi.request(config)
          } catch (retryError) {

            return Promise.reject(error)
          }
        } else {

          clearCsrfToken()

          return Promise.reject(error)
        }
      }
    } catch (csrfError) {

      return Promise.reject(error)
    }
  }

  if (error.response?.status === 401 || error.response?.status === 403) {
    const errorData = error.response?.data
    let errorMessage = ''
    let errorCode = ''
    if (errorData && typeof errorData === 'object') {
      if ('error' in errorData && typeof errorData.error === 'string') {
        errorCode = errorData.error
        errorMessage = errorData.error
      } else if ('message' in errorData && typeof errorData.message === 'string') {
        errorMessage = errorData.message
      }
    }

    // Silently handle CSRF token fetch errors - these are expected when not authenticated
    if (isCsrfTokenEndpoint && error.response?.status === 401) {
      // This is expected - CSRF tokens require authentication
      // Don't show error or log it - just reject silently
      return Promise.reject(error)
    }

    // Silently handle /api/users/me 401 errors during initialization - these are expected when not authenticated
    if (isMeEndpoint && error.response?.status === 401) {
      // This is expected during initialization when checking auth status
      // Don't show error or log it - just reject silently
      return Promise.reject(error)
    }

    // Check for any CSRF-related errors and silently reject them
    if (errorCode === 'CSRF_TOKEN_FAILED' || errorCode === 'CSRF_ERROR' || 
        errorMessage.includes('CSRF') || errorMessage.includes('csrf token')) {
      // Silently reject CSRF errors - they're expected when not authenticated
      return Promise.reject(error)
    }

    if (errorMessage.includes('Static roles cannot manage RBAC')) {

      return Promise.reject(error)
    }

    const isAuthError = isAuthenticationError(error.response.status, errorData)

    if (isAuthError) {
      // Double-check that this isn't /api/users/me (should have been caught earlier, but safety check)
      if (isMeEndpoint && error.response?.status === 401) {
        // This is expected during initialization - don't show error
        return Promise.reject(error)
      }

      const isManagementPage = window.location.pathname === '/management-page'

      if (!isWebhooksEndpoint && !isManagementPage && !isMeEndpoint) {
        const authErrorMessage = (errorData && typeof errorData === 'object' && 'message' in errorData && typeof errorData.message === 'string')
          ? errorData.message
          : 'Unauthorized access'
        handleAuthError({
          status: error.response?.status || 401,
          message: authErrorMessage,
          response: errorData
        })
      }
    }
  }

  if (error.response?.status === 429) {
    const retryAfter = error.response?.headers?.['retry-after'] || error.response?.headers?.['Retry-After']
    const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : null

    if (errorHandlers?.showWarning) {
      const message = retryAfterSeconds
        ? `Too many requests. Please wait ${retryAfterSeconds} seconds before trying again.`
        : 'Too many requests. Please wait a moment before trying again. The request will be retried automatically with exponential backoff.'

      errorHandlers.showWarning(
        'Rate Limit Exceeded',
        message,
        8000
      )
    }
  }

  if (error.response?.status === 402 || error.response?.status === 410) {
    if (errorHandlers?.handleProjectExpiration) {
      errorHandlers.handleProjectExpiration(error.response.status, error.response.data)
    }
  }

  // Don't show errors for CSRF token endpoint - 401 errors are expected when not authenticated
  // Also skip network errors for CSRF token endpoint - they're not critical
  // Also don't show errors for /api/users/me - 401 errors are expected during initialization
  if (!isWebhooksEndpoint && !isCsrfTokenEndpoint && !isMeEndpoint && errorHandlers?.showError) {
    const status = error.response?.status
    const errorData = error.response?.data
    const message = (errorData && typeof errorData === 'object' && 'message' in errorData)
      ? (errorData.message as string) || error.message || 'An unexpected error occurred'
      : error.message || 'An unexpected error occurred'

    // Check if this is a CSRF-related error that we should ignore
    let isCsrfRelated = config?.url?.includes('/api/auth/csrf-token')
    if (!isCsrfRelated && errorData && typeof errorData === 'object') {
      if ('error' in errorData && typeof errorData.error === 'string' && errorData.error.includes('CSRF')) {
        isCsrfRelated = true
      }
    }
    
    if (isCsrfRelated) {
      // Silently ignore CSRF-related errors
      return Promise.reject(error)
    }

    if (status && status >= 500) {
      errorHandlers.showError(
        'Server Error',
        `Server error (${status}): ${message}`,
        5000
      )
    } else if (status && status >= 400 && status !== 401 && status !== 402 && status !== 403 && status !== 410 && status !== 429) {
      errorHandlers.showError(
        'Request Error',
        `Request failed (${status}): ${message}`,
        5000
      )
    } else if (!error.response) {
      // Only show network errors for actual network failures, not for CSRF token attempts or auth checks
      // Check if this might be a CSRF token fetch that failed
      const mightBeCsrfFetch = isCsrfTokenEndpoint ||
                                (config as any)?.['__isCsrfFetch'] ||
                                (error.config as any)?.['__isCsrfFetch']
      
      // Check if this is a /api/users/me request (auth check during initialization)
      const mightBeMeEndpoint = isMeEndpoint
      
      // Also check if the error message indicates a CSRF or auth error
      const errorMsg = error.message || ''
      const mightBeCsrfError = errorMsg.includes('CSRF') || 
                               errorMsg.includes('csrf token') || 
                               errorMsg.includes('CSRF_TOKEN_FAILED') ||
                               errorMsg.includes('No authentication token found')
      
      const mightBeAuthError = errorMsg.includes('Authentication required') ||
                               errorMsg.includes('Missing or invalid token')
      
      if (!mightBeCsrfFetch && !mightBeCsrfError && !mightBeMeEndpoint && !mightBeAuthError) {
        errorHandlers.showError(
          
          'Network Error',
          'Unable to connect to the server. Please check your internet connection.',
          5000
        )
      }
    }
  }

  return Promise.reject(error)
}

export const enhancedApi: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: API_CONFIG.HEADERS,
  withCredentials: true,
})

requestBatcher = new RequestBatcher(API_CONFIG.BATCHING.delay, enhancedApi)

enhancedApi.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const url = config.url || ''
    const fullUrl = config.baseURL ? `${config.baseURL}${url}` : url
    
    // Log requests to problematic endpoints
    const isRbacPermissionsEndpoint = url.includes('/api/rbac/users/') && url.includes('/permissions')
    const isClientsProductsEndpoint = url.includes('/api/clients/') && url.includes('/products')
    
    if (isRbacPermissionsEndpoint || isClientsProductsEndpoint) {
      const userIdMatch = url.match(/\/(\d+)\/(?:permissions|products)/)
      const userId = userIdMatch ? userIdMatch[1] : 'unknown'
      
    }
    
    // Skip CSRF token for the CSRF token endpoint itself to avoid circular dependency
    // Also skip for login/register endpoints which are CSRF-exempt
    const isAuthEndpoint = url.includes('/api/auth/login') || 
                          url.includes('/api/auth/register') ||
                          url.includes('/api/auth/csrf-token')
    
    if (!isAuthEndpoint) {
      try {
        const { getCsrfHeaders } = await import('@/lib/csrf')
        const csrfHeaders = await getCsrfHeaders()
        Object.assign(config.headers, csrfHeaders)
      } catch (error) {
        // Silently handle CSRF token fetch errors - it's not critical for all requests
        // Some endpoints (like login) are CSRF-exempt anyway
      }
    }

    if (config.data instanceof FormData) {

      delete config.headers['Content-Type']
    }

    const method = config.method?.toUpperCase()
    if (method && ['POST', 'PUT', 'PATCH'].includes(method) && config.data) {
      try {

        if (
          config.data instanceof FormData ||
          config.data instanceof File ||
          config.data instanceof Blob
        ) {

        } else {

          const { sanitizeForApi } = await import('@/lib/sanitization')
          config.data = sanitizeForApi(config.data)
        }
      } catch (error) {

      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

enhancedApi.interceptors.response.use(
  (response) => {
    const url = response.config?.url || ''
    const isRbacPermissionsEndpoint = url.includes('/api/rbac/users/') && url.includes('/permissions')
    const isClientsProductsEndpoint = url.includes('/api/clients/') && url.includes('/products')
    
    if (isRbacPermissionsEndpoint || isClientsProductsEndpoint) {
      const userIdMatch = url.match(/\/(\d+)\/(?:permissions|products)/)
      const userId = userIdMatch ? userIdMatch[1] : 'unknown'
      
    }
    
    return response
  },
  (error) => {
    const url = error.config?.url || ''
    const isRbacPermissionsEndpoint = url.includes('/api/rbac/users/') && url.includes('/permissions')
    const isClientsProductsEndpoint = url.includes('/api/clients/') && url.includes('/products')
    
    if (isRbacPermissionsEndpoint || isClientsProductsEndpoint) {
      const userIdMatch = url.match(/\/(\d+)\/(?:permissions|products)/)
      const userId = userIdMatch ? userIdMatch[1] : 'unknown'
      const fullUrl = error.config?.baseURL ? `${error.config.baseURL}${url}` : url
      
    }
    
    return handleError(error)
  }
)

export function getApiUrl(endpoint: string): string {
  return isDevelopment ? endpoint : `${API_CONFIG.BASE_URL}${endpoint}`
}

export function getAuthHeaders(token?: string): Record<string, string> {
  return {
    ...API_CONFIG.HEADERS,
  }
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>

    // Check if this is a CSRF token endpoint error - these should be handled silently
    const config = axiosError.config as InternalAxiosRequestConfig | undefined
    const requestUrl = config?.url || ''
    const fullUrl = config?.baseURL ? `${config.baseURL}${requestUrl}` : requestUrl
    const isCsrfTokenEndpoint = requestUrl?.includes('/api/auth/csrf-token') || fullUrl?.includes('/api/auth/csrf-token')
    const isMeEndpoint = requestUrl?.includes('/api/users/me') || 
                         fullUrl?.includes('/api/users/me') ||
                         requestUrl?.endsWith('/me') ||
                         fullUrl?.endsWith('/me')

    if (axiosError.response) {
      const { status, data } = axiosError.response

      const parsedError = parseErrorResponse(data)

      const getMessage = (err: ApiErrorResponse | null): string | null => {
        if (!err) return null

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

      // Check for CSRF-related errors and handle them gracefully
      const isCsrfError = isCsrfTokenEndpoint || 
                          (parsedError && 'error' in parsedError && 
                           (String(parsedError.error).includes('CSRF') || 
                            String(parsedError.error) === 'CSRF_TOKEN_FAILED')) ||
                          (errorMessage && (errorMessage.includes('CSRF') || 
                                            errorMessage.includes('No authentication token found')))

      // For CSRF token endpoint errors, return a generic message that won't confuse users
      if (isCsrfError && isCsrfTokenEndpoint) {
        return 'Authentication required'
      }

      // For /api/users/me 401 errors, return a generic message - these are expected during initialization
      if (isMeEndpoint && status === 401) {
        return 'Authentication required'
      }

      switch (status) {
        case 400:
          return errorMessage || 'Invalid request. Please check your input and try again.'
        case 401:
          // For CSRF errors on 401, return a generic auth message
          if (isCsrfError) {
            return 'Authentication required'
          }
          return errorMessage || 'Your session has expired. Please log in again.'
        case 403:

          if (parsedError && 'error' in parsedError && parsedError.error === 'CSRF_ERROR') {
            return errorMessage || 'CSRF token missing or invalid. Please refresh the page and try again.'
          }
          // Check for CSRF_TOKEN_FAILED errors
          if (isCsrfError) {
            return 'Authentication required'
          }
          return errorMessage || 'You don\'t have permission to perform this action.'
        case 404:
          return errorMessage || 'The requested resource was not found.'
        case 409:
          return errorMessage || 'A conflict occurred. This may be because the resource already exists.'
        case 429:

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

export default enhancedApi
