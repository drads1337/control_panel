import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { apiCallWithErrorData } from '@/shared/api/api-wrapper'
import type { NavigationConfig } from '../model/types'

export async function getNavigationConfig(): Promise<NavigationConfig> {
  return apiCallWithErrorData(() => api.get(API_ENDPOINTS.NAVIGATION))
}