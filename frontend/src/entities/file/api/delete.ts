import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { handleAxiosCsrfError } from '@/lib/csrf'

// File deletion functions
export async function deleteGameConfig(configId: number): Promise<any> {
  try {
    // CSRF token and credentials are automatically handled by axios interceptors in base.ts
    const response = await api.delete(`${API_ENDPOINTS.FILES}/game-files/config/${configId}`)
    return response.data
  } catch (err: any) {
    console.error('🔧 [deleteGameConfig] Exception caught:', err)
    
    // Handle CSRF errors specifically
    await handleAxiosCsrfError(err)
    
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete game config')
  }
}

export async function deleteGameExtraFile(fileId: number): Promise<any> {
  try {
    // CSRF token and credentials are automatically handled by axios interceptors in base.ts
    const response = await api.delete(`${API_ENDPOINTS.FILES}/game-files/extra/${fileId}`)
    return response.data
  } catch (err: any) {
    console.error('🔧 [deleteGameExtraFile] Exception caught:', err)
    
    // Handle CSRF errors specifically
    await handleAxiosCsrfError(err)
    
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete game extra file')
  }
}

export async function deleteGameFile(gameId: number, fileType: 'logo' | 'banner' | 'loader'): Promise<any> {
  try {
    // CSRF token and credentials are automatically handled by axios interceptors in base.ts
    const response = await api.delete(`${API_ENDPOINTS.FILES}/game-files/${gameId}/${fileType}`)
    return response.data
  } catch (err: any) {
    console.error('🔧 [deleteGameFile] Exception caught:', err)
    
    // Handle CSRF errors specifically
    await handleAxiosCsrfError(err)
    
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete game file')
  }
}
