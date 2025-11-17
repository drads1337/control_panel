import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { getGames } from '@/entities/game'
import type { Game } from '@/entities/game';
import type { Log } from '@/entities/log';

// File upload functions
// All functions use centralized axios instance with CSRF protection via interceptor in base.ts
export async function uploadGameConfig(
  file: File, 
  gameId: number, 
  name: string = '', 
  description: string = '', 
  version: string = '1.0.0', 
  isPublic: boolean = true
): Promise<any> {
  // First, get the game name from the game ID
  const games = await getGames('all')
  const game = games.games.find(g => g.id === gameId)
  if (!game) {
    throw new Error('Game not found')
  }
  
  const formData = new FormData()
  formData.append('file', file)
  formData.append('game_name', game.name)
  formData.append('name', name)
  formData.append('description', description)
  formData.append('version', version)
  formData.append('is_public', isPublic.toString())
  
  try {
    // CSRF token is automatically added by axios interceptor in base.ts
    // Don't set Content-Type for FormData - axios will set it with boundary automatically
    const response = await api.post(`${API_ENDPOINTS.FILES}/game-files/config`, formData)
    return response.data
  } catch (error: any) {
    const errorData = error.response?.data || {}
    throw new Error(errorData.error || error.message || 'Failed to upload game config')
  }
}

export async function uploadGameExtraFile(
  file: File, 
  gameId: number, 
  name: string = '', 
  description: string = ''
): Promise<any> {
  // Validate file input
  if (!file) {
    throw new Error('No file provided')
  }
  
  if (!(file instanceof File)) {
    throw new Error('Invalid file object provided')
  }
  
  if (!file.name || file.size === undefined) {
    throw new Error('File object is incomplete')
  }
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('game_id', gameId.toString())
    formData.append('name', name)
    formData.append('description', description)
    
    // Verify FormData contains the file
    const fileEntry = formData.get('file')
    if (!fileEntry || !(fileEntry instanceof File)) {
      throw new Error('Failed to append file to FormData')
    }
    
    // CSRF token is automatically added by axios interceptor in base.ts
    // Don't set Content-Type for FormData - axios will set it with boundary automatically
    const response = await api.post(`${API_ENDPOINTS.FILES}/game-files/extra`, formData)
    return response.data
  } catch (err: any) {
    console.error('🔧 [uploadGameExtraFile] Exception caught:', err)
    const errorData = err.response?.data || {}
    throw new Error(errorData.error || err.message || 'Failed to upload game extra file')
  }
}

export async function uploadGameFiles(
  gameId: number,
  files: { file: File; type: 'logo' | 'banner' | 'file' }[],
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<any> {
  const formData = new FormData()
  
  console.log('Uploading files:', files.map(f => ({ name: f.file.name, type: f.type, size: f.file.size })))
  console.log('Files are File objects:', files.map(f => f.file instanceof globalThis.File))
  
  // Add files and their types
  files.forEach(({ file, type }, index) => {
    console.log(`Adding file: ${file.name} with type: ${type}`)
    console.log(`File is File object:`, file instanceof globalThis.File)
    console.log(`File constructor:`, file.constructor.name)
    
    // Use different keys for each file
    formData.append(`file_${index}`, file)
    formData.append(`file_type_${index}`, type)
  })
  
  // Also add the total number of files
  formData.append('file_count', files.length.toString())
  
  // Log FormData contents
  console.log('FormData entries:')
  for (let [key, value] of formData.entries()) {
    console.log(`${key}:`, value)
  }
  
  // NOTE: This function uses XMLHttpRequest instead of axios for progress tracking
  // CSRF token must be added manually here because XMLHttpRequest doesn't use axios interceptors
  // This is the only exception to centralized CSRF handling - all other functions use axios
  const { getCsrfHeaders } = await import('@/lib/csrf')
  const csrfHeaders = await getCsrfHeaders()
  const { getApiUrl } = await import('@/shared/api')
  const url = getApiUrl(`${API_ENDPOINTS.GAMES}/${gameId}/files`)
  console.log('Upload URL:', url)
  
  // Use XMLHttpRequest for progress tracking (axios onUploadProgress could be used, but XHR is more reliable)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100)
        // For multiple files, we'll estimate progress per file
        const progressPerFile = Math.round(progress / files.length)
        files.forEach((_, index) => {
          onProgress(index, Math.min(progressPerFile, 100))
        })
      }
    })
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve(response)
        } catch (error) {
          resolve(xhr.responseText)
        }
      } else {
        reject(new Error(`Failed to upload application files: ${xhr.statusText} - ${xhr.responseText}`))
      }
    })
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'))
    })
    
    xhr.open('POST', url)
    // Use httpOnly cookies for authentication - no Bearer token needed
    // Add CSRF token header manually (exception to centralized CSRF handling)
    if (csrfHeaders['X-CSRFToken']) {
      xhr.setRequestHeader('X-CSRFToken', csrfHeaders['X-CSRFToken'])
    }
    xhr.withCredentials = true // Include httpOnly cookies
    xhr.send(formData)
  })
}
