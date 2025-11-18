import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { NavigationConfig } from '../model/types'

export async function getNavigationConfig(): Promise<NavigationConfig> {
  try {
    const response = await api.get(API_ENDPOINTS.NAVIGATION)
    return response.data
  } catch (err: any) {

    const errorData = err.response?.data || {}
    throw new Error(errorData.error || err.message || 'Failed to fetch navigation configuration')
  }
}
