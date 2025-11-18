import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { LoadersResponse, LoaderGamesResponse, CreateLoaderData, UpdateLoaderData, LoaderConfigData, Loader } from '@/entities/loader';
import type {
  LoadersResponse as LoaderTypesResponse,
  LoaderGamesResponse as LoaderGamesResponseType,
  LoaderStatsResponse as LoaderStatsResponseType,
  CreateLoaderData as CreateLoaderDataType,
  UpdateLoaderData as UpdateLoaderDataType,
  LoaderConfigData as LoaderConfigDataType
} from '../model/types'

export async function getLoaders(): Promise<LoaderTypesResponse> {

  const response = await api.get(API_ENDPOINTS.LOADERS)
  return response.data
}

export async function getAvailableGames(): Promise<LoaderGamesResponseType> {

  const response = await api.get(API_ENDPOINTS.LOADERS_AVAILABLE_GAMES)
  return response.data
}

export async function createLoader(data: CreateLoaderData): Promise<{ loader: any; success: boolean; message: string }> {
  try {

    const response = await api.post(API_ENDPOINTS.LOADERS, data)
    return response.data
  } catch (err: any) {

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create loader')
  }
}

export async function updateLoader(loaderId: number, data: UpdateLoaderData): Promise<{ success: boolean; message: string }> {
  try {

    const response = await api.put(`${API_ENDPOINTS.LOADERS}/${loaderId}`, data)
    return response.data
  } catch (err: any) {

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update loader')
  }
}

export async function deleteLoader(loaderId: number): Promise<{ success: boolean; message: string }> {
  try {

    const response = await api.delete(`${API_ENDPOINTS.LOADERS}/${loaderId}`)
    return response.data
  } catch (err: any) {

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete loader')
  }
}

export async function assignGamesToLoader(loaderId: number, gameIds: number[]): Promise<{ success: boolean; message: string }> {
  try {

    const response = await api.post(`${API_ENDPOINTS.LOADERS}/${loaderId}/assign-games`, { game_ids: gameIds })
    return response.data
  } catch (err: any) {

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to assign games to loader')
  }
}

export async function unassignGamesFromLoader(loaderId: number, gameIds: number[]): Promise<{ success: boolean; message: string }> {

  const loadersResponse = await api.get(API_ENDPOINTS.LOADERS)
  const loadersData = loadersResponse.data
  const loader = loadersData.loaders?.find((l: any) => l.id === loaderId)

  if (!loader) {
    throw new Error('Loader not found')
  }

  const currentAssignedGames = loader.assigned_games || []

  const updatedGameIds = currentAssignedGames.filter((id: number) => !gameIds.includes(id))

  return assignGamesToLoader(loaderId, updatedGameIds)
}

export async function updateLoaderStatus(loaderId: number, status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<{ success: boolean; message: string }> {
  try {

    const response = await api.put(`${API_ENDPOINTS.LOADERS}/${loaderId}/status`, { status })
    return response.data
  } catch (err: any) {

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update loader status')
  }
}

export async function updateLoaderConfig(loaderId: number, config: LoaderConfigData): Promise<{ success: boolean; message: string; config: any }> {
  try {

    const response = await api.put(`${API_ENDPOINTS.LOADERS}/${loaderId}/config`, config)
    return response.data
  } catch (err: any) {

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update loader config')
  }
}

export async function getLoaderStats(): Promise<LoaderStatsResponseType> {

  const response = await api.get(API_ENDPOINTS.LOADERS_STATS)
  return response.data
}

export async function recordLoaderDownload(loaderId: number): Promise<{ success: boolean; download_url?: string; filename?: string; downloads: number }> {
  try {

    const response = await api.post(`${API_ENDPOINTS.LOADERS}/${loaderId}/download`)
    return response.data
  } catch (err: any) {

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to record loader download')
  }
}

export async function uploadLoaderFiles(loaderId: number, files: FormData): Promise<{ success: boolean; message: string; uploaded_files: Record<string, string> }> {
  try {

    const response = await api.post(`${API_ENDPOINTS.LOADERS}/${loaderId}/files`, files)
    return response.data
  } catch (err: any) {

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to upload loader files')
  }
}
