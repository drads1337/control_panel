import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { FileItem, GameFileStats, FileStats, CreateFolderData } from '@/entities/file';
import type {
  FileItem as FileItemType,
  GameFileStats as GameFileStatsType,
  FileStats as FileStatsType,
  CreateFolderData as CreateFolderDataType
} from '../model/types'

export async function getGameFiles(
  gameId: number, 
  category: string = 'all', 
  status: string = 'all', 
  search: string = '',
  targetType: 'game' | 'loader' | 'auto' = 'auto'
): Promise<{ files: FileItemType[]; total: number }> {
  const params: Record<string, string> = {
    game_id: gameId.toString(),
    category,
    status,
    search
  }

  if (targetType !== 'auto') {
    params.target_type = targetType
  }

  const endpoint = API_ENDPOINTS.GAME_FILES;

  try {
    const response = await api.get(endpoint, { params });
    return response.data;
  } catch (error: any) {

    if (error.name === 'TypeError' || error.message?.includes('Network')) {
      const networkError = new Error(`Network error: Unable to reach server. Check if the server is running and accessible.`);
      (networkError as any).originalError = error;
      throw networkError;
    }

    throw error;
  }
}

export async function getGameFileStats(gameId: number): Promise<GameFileStatsType> {

  const response = await api.get(`${API_ENDPOINTS.GAME_FILE_STATS}/${gameId}`)
  return response.data
}

export async function getFileStats(): Promise<FileStatsType> {

  const response = await api.get(API_ENDPOINTS.FILE_STATS)
  return response.data
}

export async function createFolder(data: CreateFolderDataType): Promise<any> {

  const response = await api.post(API_ENDPOINTS.FOLDERS, data)
  return response.data
}

export async function deleteFolder(folderPath: string): Promise<any> {

  const response = await api.delete(`${API_ENDPOINTS.FOLDERS}/${encodeURIComponent(folderPath)}`)
  return response.data
}
