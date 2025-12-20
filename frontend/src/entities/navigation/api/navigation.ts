import { enhancedApi as api } from '@/lib/api/enhanced-client'
import { API_ENDPOINTS } from '@/lib/api/config'
import { apiCallWithErrorData } from '@/lib/api/api-wrapper'
import type { NavigationConfig } from '../model/types'

export async function getNavigationConfig(): Promise<NavigationConfig> {
  return apiCallWithErrorData(() => api.get(API_ENDPOINTS.NAVIGATION))
}