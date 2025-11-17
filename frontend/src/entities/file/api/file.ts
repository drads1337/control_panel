import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { FileItem, GameFileStats, FileStats, CreateFolderData } from '@/entities/file';
import type {
  FileItem as FileItemType,
  GameFileStats as GameFileStatsType,
  FileStats as FileStatsType,
  CreateFolderData as CreateFolderDataType
} from '../model/types'

// File API functions
// All functions use centralized axios instance with CSRF protection
export async function getGameFiles(
  gameId: number, 
  category: string = 'all', 
  status: string = 'all', 
  search: string = '',
  targetType: 'game' | 'loader' | 'auto' = 'auto'
): Promise<{ files: FileItemType[]; total: number }> {
  console.log('📁 [getGameFiles] Starting API call', {
    gameId,
    category,
    status,
    search,
    targetType,
    timestamp: new Date().toISOString()
  });
  
  // Build params object
  const params: Record<string, string> = {
    game_id: gameId.toString(),
    category,
    status,
    search
  }
  
  // Add target_type parameter if specified
  if (targetType !== 'auto') {
    params.target_type = targetType
  }
  
  const endpoint = API_ENDPOINTS.GAME_FILES;
  console.log('📁 [getGameFiles] Endpoint config:', {
    GAME_FILES: endpoint,
    rawValue: endpoint
  });
  
  try {
    console.log('📁 [getGameFiles] Making axios request...');
    const fetchStartTime = performance.now();
    
    // CSRF token and credentials are automatically handled by axios interceptors
    const response = await api.get(endpoint, { params });
    
    const fetchDuration = performance.now() - fetchStartTime;
    
    console.log('📁 [getGameFiles] Response received:', {
      status: response.status,
      statusText: response.statusText,
      duration: `${fetchDuration.toFixed(2)}ms`
    });
    
    console.log('📁 [getGameFiles] API response success:', {
      filesCount: response.data.files?.length || 0,
      total: response.data.total,
      hasFiles: Array.isArray(response.data.files),
      resultKeys: Object.keys(response.data),
      sampleFile: response.data.files?.[0] || null
    });
    
    return response.data;
  } catch (error: any) {
    console.error('📁 [getGameFiles] Exception caught:', {
      message: error.message,
      status: error.response?.status,
      name: error.name,
      stack: error.stack,
      url: error.config?.url,
      response: error.response?.data,
      cause: error.cause
    });
    
    // Re-throw with more context
    if (error.name === 'TypeError' || error.message?.includes('Network')) {
      const networkError = new Error(`Network error: Unable to reach server. Check if the server is running and accessible.`);
      (networkError as any).originalError = error;
      throw networkError;
    }
    
    throw error;
  }
}

export async function getGameFileStats(gameId: number): Promise<GameFileStatsType> {
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.get(`${API_ENDPOINTS.GAME_FILE_STATS}/${gameId}`)
  return response.data
}

export async function getFileStats(): Promise<FileStatsType> {
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.get(API_ENDPOINTS.FILE_STATS)
  return response.data
}

export async function createFolder(data: CreateFolderDataType): Promise<any> {
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.post(API_ENDPOINTS.FOLDERS, data)
  return response.data
}

export async function deleteFolder(folderPath: string): Promise<any> {
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.delete(`${API_ENDPOINTS.FOLDERS}/${encodeURIComponent(folderPath)}`)
  return response.data
}
