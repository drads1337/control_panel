import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { getErrorMessage, isAxiosError } from '@/lib/error-utils'
import type { NavigationConfig } from '../model/types'

export async function getNavigationConfig(): Promise<NavigationConfig> {
  try {
    const response = await api.get(API_ENDPOINTS.NAVIGATION)
    return response.data
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
      const errorData = err.response.data as { error?: string }
      throw new Error(errorData.error || getErrorMessage(err))
    }
    throw new Error(getErrorMessage(err))
  }
}