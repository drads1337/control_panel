import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { getProducts } from '@/entities/product'
import { getErrorMessage, isAxiosError } from '@/lib/error-utils'

export async function uploadProductConfig(
  file: File, 
  productId: number, 
  name: string = '', 
  description: string = '', 
  version: string = '1.0.0', 
  isPublic: boolean = true
): Promise<any> {

  const products = await getProducts('all')
  const product = products.products.find(g => g.id === productId)
  if (!product) {
    throw new Error('Product not found')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('product_name', product.name)
  formData.append('name', name)
  formData.append('description', description)
  formData.append('version', version)
  formData.append('is_public', isPublic.toString())

  try {

    const response = await api.post(`${API_ENDPOINTS.FILES}/product-files/config`, formData)
    return response.data
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
      const errorData = error.response.data as { error?: string }
      throw new Error(errorData.error || getErrorMessage(error))
    }
    throw new Error(getErrorMessage(error))
  }
}

export async function uploadProductExtraFile(
  file: File, 
  productId: number, 
  name: string = '', 
  description: string = ''
): Promise<any> {

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
    formData.append('product_id', productId.toString())
    formData.append('name', name)
    formData.append('description', description)

    const fileEntry = formData.get('file')
    if (!fileEntry || !(fileEntry instanceof File)) {
      throw new Error('Failed to append file to FormData')
    }

    const response = await api.post(`${API_ENDPOINTS.FILES}/product-files/extra`, formData)
    return response.data
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
      const errorData = err.response.data as { error?: string }
      throw new Error(errorData.error || getErrorMessage(err))
    }
    throw new Error(getErrorMessage(err))
  }
}

export async function uploadProductFiles(
  productId: number,
  files: { file: File; type: 'logo' | 'banner' | 'background' | 'file' }[],
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<any> {
  const formData = new FormData()

  formData.append('product_id', productId.toString())

  files.forEach(({ file, type }, index) => {
    formData.append(`file_${index}`, file)
    formData.append(`file_type_${index}`, type)
  })

  formData.append('file_count', files.length.toString())

  const { getCsrfHeaders } = await import('@/lib/csrf')
  const csrfHeaders = await getCsrfHeaders()
  const { getApiUrl } = await import('@/shared/api')
  // Use universal endpoint - products instead of products
  const url = getApiUrl(`${API_ENDPOINTS.PRODUCTS}/${productId}/files`)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100)

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
        reject(new Error(`Failed to upload product files: ${xhr.statusText} - ${xhr.responseText}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'))
    })

    xhr.open('POST', url)

    if (csrfHeaders['X-CSRFToken']) {
      xhr.setRequestHeader('X-CSRFToken', csrfHeaders['X-CSRFToken'])
    }
    xhr.withCredentials = true
    xhr.send(formData)
  })
}
