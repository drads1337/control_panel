import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { preventDuplicateRequest } from '@/lib/request-manager'
import { getApiBaseUrl } from '@/lib/utils'
import type { LicenseKeysResponse, CreateKeyData, BulkCreateKeysData, CreateLoaderKeyData, BulkCreateLoaderKeysData, LicenseKey, KeysStats } from '@/entities/key';
import type {
  LicenseKeysResponse as LicenseKeysResponseType,
  CreateKeyData as CreateKeyDataType,
  BulkCreateKeysData as BulkCreateKeysDataType,
  CreateLoaderKeyData as CreateLoaderKeyDataType,
  BulkCreateLoaderKeysData as BulkCreateLoaderKeysDataType,
  LicenseKey as LicenseKeyType,
  KeysStats as KeysStatsType
} from '../model/types'

export async function getLicenseKeys(
  page: number = 1, 
  perPage: number = 20, 
  status?: string,
  gameId?: number,
  search?: string,
  myKeys?: boolean
): Promise<LicenseKeysResponseType> {
  const params: any = {
    page: page.toString(),
    per_page: perPage.toString(),
  }

  if (status) params.status = status
  if (gameId) params.game_id = gameId.toString()
  if (search) params.search = search
  if (myKeys) params.my_keys = 'true'

  const requestKey = `keys-${page}-${perPage}-${status || 'all'}-${gameId || 'all'}-${search || ''}-${myKeys ? 'my' : 'all'}`

  return preventDuplicateRequest(requestKey, async () => {

    const response = await api.get(API_ENDPOINTS.KEYS, { params })
    return response.data
  })
}

export async function createLicenseKey(data: CreateKeyDataType): Promise<{ message: string; key: LicenseKeyType }> {

  const apiBaseUrl = getApiBaseUrl()
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const isDevelopment = import.meta.env.DEV

  try {

    await api.get('/api/users/me')
  } catch (error: any) {
    if (error.response?.status === 401) {
      const errorMsg = currentOrigin.includes('192.168.1.7')
        ? '❌ Не авторизован! Войдите снова через http://192.168.1.7:3000 (не через localhost). Cookies привязаны к домену.'
        : '❌ Не авторизован! Пожалуйста, войдите снова.'
      throw new Error(errorMsg)
    }

  }

  try {

    const response = await api.post(API_ENDPOINTS.KEYS, data, {
      timeout: 30000,
    })

    return response.data
  } catch (error: any) {

    if (error.response?.status === 401) {
      let errorMsg = '❌ Ошибка авторизации! '

      if (currentOrigin.includes('192.168.1.7')) {
        errorMsg += 'Войдите снова через http://192.168.1.7:3000 (НЕ через localhost!). Cookies работают только для того домена, через который вы вошли.'
      } else if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
        errorMsg += 'Войдите снова. Проверьте, что вы вошли через правильный адрес.'
      } else {
        errorMsg += 'Пожалуйста, войдите снова. Cookies могут быть не установлены правильно.'
      }

      errorMsg += '\n\nПроверьте:\n1. Откройте DevTools → Application → Cookies\n2. Убедитесь, что access_token_cookie существует для ' + currentOrigin + '\n3. Если нет - войдите снова'

      throw new Error(errorMsg)
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Request timeout. The server may be processing your request. Please refresh the page and check if the key was created.')
    }

    if (error.response?.data?.error === 'VALIDATION_ERROR' && error.response?.data?.details) {
      const validationErrors = error.response.data.details
      const errorMessages = validationErrors.map((err: any) => {
        const field = err.loc?.join('.') || 'field'
        return `${field}: ${err.msg}`
      }).join(', ')
      throw new Error(`Validation failed: ${errorMessages}`)
    }

    if (error.response?.data?.error === 'INTERNAL_ERROR') {
      const serverMessage = error.response?.data?.message || 'Internal server error'
      const details = error.response?.data?.details
      const traceback = error.response?.data?.traceback

      let errorMsg = 'Internal server error occurred while creating the license key.'

      if (serverMessage && serverMessage !== 'Internal server error') {
        errorMsg += ` ${serverMessage}`
      }

      if (details) {
        errorMsg += ` Details: ${details}`
      }

      if (import.meta.env.DEV && traceback) {

      }

      throw new Error(errorMsg)
    }

    const errorMessage = error.response?.data?.error || error.response?.data?.msg || error.message || 'Failed to create license key'
    throw new Error(errorMessage)
  }
}

export async function createCustomLicenseKey(data: CreateKeyDataType & { custom_key: string }): Promise<{ message: string; key: LicenseKeyType }> {
  try {

    const response = await api.post(API_ENDPOINTS.KEYS_CUSTOM, data)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.msg || err.message || 'Failed to create custom license key')
  }
}

export async function bulkCreateLicenseKeys(data: BulkCreateKeysDataType): Promise<{ message: string; keys: string[]; summary: any }> {
  try {

    const isDevelopment = import.meta.env.DEV

    const apiBaseUrl = getApiBaseUrl()
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : ''

    const response = await api.post(API_ENDPOINTS.KEYS_BULK, data)

    return response.data
  } catch (err: any) {

    if (err.response?.status === 401) {
      throw new Error('Authentication required. Please log in again. Cookies may not be set properly.')
    }

    if (err.response?.status === 403 && (err.response?.data?.error === 'CSRF_ERROR' || err.response?.data?.error?.includes('CSRF'))) {
      const { clearCsrfToken } = await import('@/lib/csrf')
      clearCsrfToken()
      throw new Error('CSRF token validation failed. Please refresh the page and try again.')
    }

    throw new Error(err.response?.data?.error || err.response?.data?.msg || err.message || 'Failed to create bulk license keys')
  }
}

export async function createLoaderKey(data: CreateLoaderKeyDataType): Promise<{ message: string; key: string; games: any[] }> {
  try {

    const response = await api.post(API_ENDPOINTS.KEYS_LOADER, data)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.message || 'Failed to create loader key')
  }
}

export async function createCustomLoaderKey(data: CreateLoaderKeyData & { custom_key: string }): Promise<{ message: string; key: string; games: any[] }> {
  try {

    const response = await api.post(API_ENDPOINTS.KEYS_LOADER_CUSTOM, data)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.message || 'Failed to create custom loader key')
  }
}

export async function bulkCreateLoaderKeys(data: BulkCreateLoaderKeysDataType): Promise<{ message: string; keys: string[]; summary: any }> {
  try {

    const response = await api.post(API_ENDPOINTS.KEYS_BULK_LOADER, data)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.message || 'Failed to create bulk loader keys')
  }
}

export async function getKeysStats(): Promise<KeysStatsType> {
  try {

    const response = await api.get(API_ENDPOINTS.KEYS_STATS)
    return response.data.stats || response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch keys stats')
  }
}
