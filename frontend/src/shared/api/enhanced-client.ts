
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { handleAuthError } from './auth-error-handler'
import { parseErrorResponse, type ApiErrorResponse } from './error-schemas'
import { getApiBaseUrl } from '@/lib/utils'

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

  const isWebhooksEndpoint = config?.url?.includes('/api/webhooks/')

  if (import.meta.env.PROD && typeof window !== 'undefined') {

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
    const errorData = error.response?.data as any
    const errorMessage = errorData?.error || errorData?.message || ''

    if (errorMessage.includes('CSRF') || errorMessage === 'CSRF_ERROR') {
      return Promise.reject(error)
    }

    if (errorMessage.includes('Static roles cannot manage RBAC')) {

      return Promise.reject(error)
    }

    const isAuthError = isAuthenticationError(error.response.status, errorData)

    if (isAuthError) {

      const isManagementPage = window.location.pathname === '/management-page'

      if (!isWebhooksEndpoint && !isManagementPage) {
        handleAuthError({
          status: error.response?.status || 401,
          message: errorData?.message || 'Unauthorized access',
          response: errorData
        })
      }
    }
  }

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

    })
  }

  if (error.response?.status === 402 || error.response?.status === 410) {
    import('@/lib/global-notifications').then(({ triggerProjectExpiration }) => {
      triggerProjectExpiration(error.response!.status, error.response!.data)
    }).catch(() => {

    })
  }

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

    })
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

    try {
      const { getCsrfHeaders } = await import('@/lib/csrf')
      const csrfHeaders = await getCsrfHeaders()
      Object.assign(config.headers, csrfHeaders)
    } catch (error) {

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
  (response) => response,
  handleError
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

      switch (status) {
        case 400:
          return errorMessage || 'Invalid request. Please check your input and try again.'
        case 401:

          return errorMessage || 'Your session has expired. Please log in again.'
        case 403:

          if (parsedError && 'error' in parsedError && parsedError.error === 'CSRF_ERROR') {
            return errorMessage || 'CSRF token missing or invalid. Please refresh the page and try again.'
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
