import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { handleAxiosCsrfError } from '@/lib/csrf'

export async function deleteGameConfig(configId: number): Promise<any> {
  try {

    const response = await api.delete(`${API_ENDPOINTS.FILES}/game-files/config/${configId}`)
    return response.data
  } catch (err: any) {

    await handleAxiosCsrfError(err)

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete game config')
  }
}

export async function deleteGameExtraFile(fileId: number): Promise<any> {
  try {

    const response = await api.delete(`${API_ENDPOINTS.FILES}/game-files/extra/${fileId}`)
    return response.data
  } catch (err: any) {

    await handleAxiosCsrfError(err)

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete game extra file')
  }
}

export async function deleteGameFile(gameId: number, fileType: 'logo' | 'banner' | 'loader'): Promise<any> {
  try {

    const response = await api.delete(`${API_ENDPOINTS.FILES}/game-files/${gameId}/${fileType}`)
    return response.data
  } catch (err: any) {

    await handleAxiosCsrfError(err)

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete game file')
  }
}
