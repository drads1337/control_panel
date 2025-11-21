import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { handleAxiosCsrfError } from '@/lib/csrf'

export async function deleteProductConfig(configId: number): Promise<any> {
  try {

    const response = await api.delete(`${API_ENDPOINTS.FILES}/product-files/config/${configId}`)
    return response.data
  } catch (err: any) {

    await handleAxiosCsrfError(err)

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete product config')
  }
}

export async function deleteProductExtraFile(fileId: number): Promise<any> {
  try {

    const response = await api.delete(`${API_ENDPOINTS.FILES}/product-files/extra/${fileId}`)
    return response.data
  } catch (err: any) {

    await handleAxiosCsrfError(err)

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete product extra file')
  }
}

export async function deleteProductFile(productId: number, fileType: 'logo' | 'banner' | 'agent'): Promise<any> {
  try {

    const response = await api.delete(`${API_ENDPOINTS.FILES}/product-files/${productId}/${fileType}`)
    return response.data
  } catch (err: any) {

    await handleAxiosCsrfError(err)

    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete product file')
  }
}
