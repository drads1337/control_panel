import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { getErrorMessage, isErrorWithMessage } from '@/lib/error-utils'
import type { FileItem, ProductFileStats, FileStats, CreateFolderData } from '@/entities/file';
import type {
  FileItem as FileItemType,
  ProductFileStats as ProductFileStatsType,
  FileStats as FileStatsType,
  CreateFolderData as CreateFolderDataType
} from '../model/types'

export async function getProductFiles(
  productId: number, 
  category: string = 'all', 
  status: string = 'all', 
  search: string = '',
  targetType: 'product' | 'agent' | 'auto' = 'auto'
): Promise<{ files: FileItemType[]; total: number }> {
  const params: Record<string, string> = {
    product_id: productId.toString(),
    category,
    status,
    search
  }

  if (targetType !== 'auto') {
    params.target_type = targetType
  }

  const endpoint = API_ENDPOINTS.PRODUCT_FILES;

  try {
    const response = await api.get(endpoint, { params });
    return response.data;
  } catch (error: unknown) {
    if (error instanceof TypeError || (isErrorWithMessage(error) && error.message.includes('Network'))) {
      const networkError = new Error(`Network error: Unable to reach server. Check if the server is running and accessible.`);
      (networkError as { originalError?: unknown }).originalError = error;
      throw networkError;
    }

    throw error;
  }
}

export async function getProductFileStats(productId: number): Promise<ProductFileStatsType> {

  const response = await api.get(`${API_ENDPOINTS.PRODUCT_FILE_STATS}/${productId}`)
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
