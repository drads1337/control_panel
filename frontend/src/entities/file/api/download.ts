import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'

export async function downloadGameConfig(configId: number): Promise<Blob> {

  const response = await api.get(`${API_ENDPOINTS.FILES}/games/configs/${configId}/download`, {
    responseType: 'blob'
  })
  return response.data
}

export async function downloadConfigById(
  configId: string
): Promise<{ blob: Blob; filename: string }> {

  const response = await api.get(`${API_ENDPOINTS.FILES}/games/configs/${configId}/download`, {
    responseType: 'blob'
  })

  const contentDisposition = response.headers['content-disposition']
  let filename = `config_${configId}`

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/)
    if (filenameMatch) {
      filename = filenameMatch[1]
    }
  }

  return {
    blob: response.data,
    filename
  }
}

export async function downloadGameExtraFile(fileId: number): Promise<{ blob: Blob; filename: string }> {

  const response = await api.get(`${API_ENDPOINTS.FILES}/games/extra-files/${fileId}/download`, {
    responseType: 'blob'
  })

  const contentDisposition = response.headers['content-disposition']
  let filename = `extra_file_${fileId}`

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/)
    if (filenameMatch) {
      filename = filenameMatch[1]
    }
  }

  return {
    blob: response.data,
    filename
  }
}

export async function downloadGameFile(gameId: number, fileType: 'logo' | 'banner' | 'loader'): Promise<Blob> {

  const response = await api.get(`${API_ENDPOINTS.FILES}/game-files/${gameId}/download/${fileType}`, {
    responseType: 'blob'
  })
  return response.data
}
