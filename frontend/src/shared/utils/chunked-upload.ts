/**
 * Chunked File Upload Utility
 * 
 * SECURITY NOTE: This implements client-side chunking for large files.
 * For files > 100MB, we split them into chunks and upload sequentially
 * to avoid browser memory issues and timeout errors.
 * 
 * The backend should ideally support resumable uploads, but for now
 * we implement a simple sequential chunk upload that the backend can
 * reassemble.
 */

import { getApiUrl } from '@/shared/api';

export interface ChunkedUploadOptions {
  chunkSize?: number;
  onProgress?: (progress: number) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
}

export interface ChunkedUploadResult {
  success: boolean;
  error?: string;
  result?: any;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

/**
 * Upload a file in chunks
 * 
 * @param file File to upload
 * @param endpoint API endpoint for upload
 * @param formData Additional form data to include
 * @param options Upload options
 * @returns Upload result
 */
export async function uploadFileInChunks(
  file: File,
  endpoint: string,
  formData: Record<string, string | number | boolean> = {},
  options: ChunkedUploadOptions = {}
): Promise<ChunkedUploadResult> {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  // For small files, use regular upload
  if (totalChunks <= 1) {
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', file);
      
      Object.entries(formData).forEach(([key, value]) => {
        formDataObj.append(key, String(value));
      });

      const { getCsrfHeaders } = await import('@/shared/lib/csrf');
      const csrfHeaders = await getCsrfHeaders();
      const url = getApiUrl(endpoint);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...csrfHeaders,
        },
        credentials: 'include',
        body: formDataObj,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        return {
          success: false,
          error: errorData.error || `Upload failed with status ${response.status}`,
        };
      }

      const result = await response.json();
      options.onProgress?.(100);
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  // For large files, use chunked upload
  // Generate a unique upload ID
  const uploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  
  try {
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      const chunkFormData = new FormData();
      chunkFormData.append('file', chunk, file.name);
      chunkFormData.append('upload_id', uploadId);
      chunkFormData.append('chunk_index', String(chunkIndex));
      chunkFormData.append('total_chunks', String(totalChunks));
      chunkFormData.append('file_name', file.name);
      chunkFormData.append('file_size', String(file.size));
      chunkFormData.append('chunk_size', String(chunk.size));
      
      Object.entries(formData).forEach(([key, value]) => {
        chunkFormData.append(key, String(value));
      });

      const { getCsrfHeaders } = await import('@/shared/lib/csrf');
      const csrfHeaders = await getCsrfHeaders();
      // Use chunk endpoint (e.g., /api/files/product-files/extra/chunk)
      const chunkUrl = getApiUrl(endpoint.includes('/chunk') ? endpoint : `${endpoint}/chunk`);
      
      const response = await fetch(chunkUrl, {
        method: 'POST',
        headers: {
          ...csrfHeaders,
        },
        credentials: 'include',
        body: chunkFormData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Chunk upload failed' }));
        return {
          success: false,
          error: errorData.error || `Chunk ${chunkIndex + 1}/${totalChunks} upload failed`,
        };
      }

      const progress = ((chunkIndex + 1) / totalChunks) * 100;
      options.onProgress?.(progress);
      options.onChunkComplete?.(chunkIndex, totalChunks);
    }

    // Finalize upload - notify backend to assemble chunks
    const finalizeFormData = new FormData();
    finalizeFormData.append('upload_id', uploadId);
    finalizeFormData.append('file_name', file.name);
    finalizeFormData.append('file_size', String(file.size));
    finalizeFormData.append('total_chunks', String(totalChunks));
    
    Object.entries(formData).forEach(([key, value]) => {
      finalizeFormData.append(key, String(value));
    });

    const { getCsrfHeaders } = await import('@/shared/lib/csrf');
    const csrfHeaders = await getCsrfHeaders();
    // Use finalize endpoint (e.g., /api/files/product-files/extra/finalize)
    const finalizeUrl = getApiUrl(endpoint.replace('/chunk', '/finalize'));
    
    const finalizeResponse = await fetch(finalizeUrl, {
      method: 'POST',
      headers: {
        ...csrfHeaders,
      },
      credentials: 'include',
      body: finalizeFormData,
    });

    if (!finalizeResponse.ok) {
      const errorData = await finalizeResponse.json().catch(() => ({ error: 'Finalization failed' }));
      return {
        success: false,
        error: errorData.error || 'Failed to finalize chunked upload',
      };
    }

    const result = await finalizeResponse.json();
    options.onProgress?.(100);
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Chunked upload failed',
    };
  }
}

/**
 * Check if file should use chunked upload
 */
export function shouldUseChunkedUpload(fileSize: number, threshold: number = 100 * 1024 * 1024): boolean {
  return fileSize > threshold;
}

