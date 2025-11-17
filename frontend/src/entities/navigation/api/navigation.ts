import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { NavigationConfig } from '../model/types'

/**
 * Get navigation configuration for the current user from the server
 * This replaces static navigation logic with a dynamic, server-driven approach
 */
export async function getNavigationConfig(): Promise<NavigationConfig> {
  try {
    const response = await api.get(API_ENDPOINTS.NAVIGATION)
    return response.data
  } catch (err: any) {
    console.error('📱 [getNavigationConfig] Exception caught:', err)
    const errorData = err.response?.data || {}
    throw new Error(errorData.error || err.message || 'Failed to fetch navigation configuration')
  }
}

