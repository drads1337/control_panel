import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { preventDuplicateRequest } from '@/lib/request-manager'
import { getErrorMessage, getErrorStatus, isAxiosError, isErrorWithMessage } from '@/lib/error-utils'
import type { LicenseKeysResponse, CreateKeyData, BulkCreateKeysData, CreateAgentKeyData, BulkCreateAgentKeysData, LicenseKey, KeysStats } from '@/entities/key';
import type {
  LicenseKeysResponse as LicenseKeysResponseType,
  CreateKeyData as CreateKeyDataType,
  BulkCreateKeysData as BulkCreateKeysDataType,
  CreateAgentKeyData as CreateAgentKeyDataType,
  BulkCreateAgentKeysData as BulkCreateAgentKeysDataType,
  LicenseKey as LicenseKeyType,
  KeysStats as KeysStatsType
} from '../model/types'

export async function getLicenseKeys(
  page: number = 1, 
  perPage: number = 20, 
  status?: string,
  productId?: number,
  search?: string,
  myKeys?: boolean
): Promise<LicenseKeysResponseType> {
  const params: any = {
    page: page.toString(),
    per_page: perPage.toString(),
  }

  if (status) params.status = status
  if (productId) params.product_id = productId.toString()
  if (search) params.search = search
  if (myKeys) params.my_keys = 'true'

  const requestKey = `keys-${page}-${perPage}-${status || 'all'}-${productId || 'all'}-${search || ''}-${myKeys ? 'my' : 'all'}`

  return preventDuplicateRequest(requestKey, async () => {

    const response = await api.get(API_ENDPOINTS.KEYS, { params })
    return response.data
  })
}

export async function createLicenseKey(data: CreateKeyDataType): Promise<{ message: string; key: LicenseKeyType }> {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  try {

    await api.get('/api/users/me')
  } catch (error: unknown) {
    const status = getErrorStatus(error)
    if (status === 401) {
      const errorMsg = 'Authentication error. Please log in again. Cookies may not be set properly.'
      throw new Error(errorMsg)
    }
  }

  try {

    const response = await api.post(API_ENDPOINTS.KEYS, data, {
      timeout: 30000,
    })

    return response.data
  } catch (error: unknown) {
    const status = getErrorStatus(error)
    
    if (status === 401) {
      let errorMsg = 'Authentication error. Please log in again. Cookies may not be set properly.'

      if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
        errorMsg += 'Please log in again. Check that you are logged in through the correct address.'
      } else {
        errorMsg += 'Please log in again. Cookies may not be set properly.'
      }

      if (import.meta.env.DEV) {
        errorMsg += '\n\nCheck:\n1. Open DevTools → Product → Cookies\n2. Ensure that access_token_cookie exists for ' + currentOrigin + '\n3. If not, log in again'
      }

      throw new Error(errorMsg)
    }

    if (isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || (isErrorWithMessage(error) && error.message.includes('timeout'))) {
        throw new Error('Request timeout. The server may be processing your request. Please refresh the page and check if the key was created.')
      }

      const errorData = error.response?.data
      if (errorData && typeof errorData === 'object') {
        if (errorData.error === 'VALIDATION_ERROR' && Array.isArray(errorData.details)) {
          const validationErrors = errorData.details
          const errorMessages = validationErrors.map((err: unknown) => {
            if (typeof err === 'object' && err !== null) {
              const errObj = err as { loc?: unknown[]; msg?: string }
              const field = Array.isArray(errObj.loc) ? errObj.loc.join('.') : 'field'
              return `${field}: ${errObj.msg || 'validation error'}`
            }
            return 'validation error'
          }).join(', ')
          throw new Error(`Validation failed: ${errorMessages}`)
        }

        if (errorData.error === 'INTERNAL_ERROR') {
          const serverMessage = (typeof errorData.message === 'string' ? errorData.message : 'Internal server error')
          const details = errorData.details
          const traceback = errorData.traceback

          let errorMsg = 'Internal server error occurred while creating the license key.'

          if (serverMessage && serverMessage !== 'Internal server error') {
            errorMsg += ` ${serverMessage}`
          }

          if (details) {
            errorMsg += ` Details: ${details}`
          }

          if (import.meta.env.DEV && traceback) {
            // Traceback logging can be added here if needed
          }

          throw new Error(errorMsg)
        }
      }
    }

    throw new Error(getErrorMessage(error))
  }
}

export async function createCustomLicenseKey(data: CreateKeyDataType & { custom_key: string }): Promise<{ message: string; key: LicenseKeyType }> {
  try {

    const response = await api.post(API_ENDPOINTS.KEYS_CUSTOM, data)
    return response.data
  } catch (err: unknown) {
    throw new Error(getErrorMessage(err))
  }
}

export async function bulkCreateLicenseKeys(data: BulkCreateKeysDataType): Promise<{ message: string; keys: string[]; summary: any }> {
  try {
    const response = await api.post(API_ENDPOINTS.KEYS_BULK, data)

    return response.data
  } catch (err: unknown) {
    const status = getErrorStatus(err)
    
    if (status === 401) {
      throw new Error('Authentication required. Please log in again. Cookies may not be set properly.')
    }

    if (status === 403 && isAxiosError(err)) {
      const errorData = err.response?.data
      if (errorData && typeof errorData === 'object') {
        const errorCode = errorData.error
        if (errorCode === 'CSRF_ERROR' || (typeof errorCode === 'string' && errorCode.includes('CSRF'))) {
          const { clearCsrfToken } = await import('@/lib/csrf')
          clearCsrfToken()
          throw new Error('CSRF token validation failed. Please refresh the page and try again.')
        }
      }
    }

    throw new Error(getErrorMessage(err))
  }
}

export async function createAgentKey(data: CreateAgentKeyDataType): Promise<{ message: string; key: string; products: any[] }> {
  try {

    const response = await api.post(API_ENDPOINTS.KEYS_AGENT, data)
    return response.data
  } catch (err: unknown) {
    throw new Error(getErrorMessage(err))
  }
}

export async function createCustomAgentKey(data: CreateAgentKeyData & { custom_key: string }): Promise<{ message: string; key: string; products: any[] }> {
  try {

    const response = await api.post(API_ENDPOINTS.KEYS_AGENT_CUSTOM, data)
    return response.data
  } catch (err: unknown) {
    throw new Error(getErrorMessage(err))
  }
}

export async function bulkCreateAgentKeys(data: BulkCreateAgentKeysDataType): Promise<{ message: string; keys: string[]; summary: any }> {
  try {

    const response = await api.post(API_ENDPOINTS.KEYS_BULK_AGENT, data)
    return response.data
  } catch (err: unknown) {
    throw new Error(getErrorMessage(err))
  }
}

export async function getKeysStats(): Promise<KeysStatsType> {
  try {

    const response = await api.get(API_ENDPOINTS.KEYS_STATS)
    return response.data.stats || response.data
  } catch (err: unknown) {
    throw new Error(getErrorMessage(err))
  }
}
