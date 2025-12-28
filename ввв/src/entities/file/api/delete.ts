import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { handleAxiosCsrfError } from '@/lib/csrf'
import { getErrorMessage } from '@/lib/error-utils'

export async function deleteProductConfig(configId: number): Promise<any> {
  try {

    const response = await api.delete(`${API_ENDPOINTS.FILES}/product-files/config/${configId}`)
    return response.data
  } catch (err: unknown) {
    await handleAxiosCsrfError(err)
    throw new Error(getErrorMessage(err))
  }
}

export async function deleteProductExtraFile(fileId: number): Promise<any> {
  try {

    const response = await api.delete(`${API_ENDPOINTS.FILES}/product-files/extra/${fileId}`)
    return response.data
  } catch (err: unknown) {
    await handleAxiosCsrfError(err)
    throw new Error(getErrorMessage(err))
  }
}

export async function deleteProductFile(productId: number, fileType: 'logo' | 'banner' | 'agent'): Promise<any> {
  try {

    const response = await api.delete(`${API_ENDPOINTS.FILES}/product-files/${productId}/${fileType}`)
    return response.data
  } catch (err: unknown) {
    await handleAxiosCsrfError(err)
    throw new Error(getErrorMessage(err))
  }
}
