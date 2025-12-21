import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { apiCall } from '@/shared/api/api-wrapper'
import { handleAxiosCsrfError } from '@/shared/lib/csrf'

export async function deleteProductConfig(configId: number): Promise<any> {
  return apiCall(() => api.delete(`${API_ENDPOINTS.FILES}/product-files/config/${configId}`), {
    onError: async (err) => {
      await handleAxiosCsrfError(err)
    }
  })
}

export async function deleteProductExtraFile(fileId: number): Promise<any> {
  return apiCall(() => api.delete(`${API_ENDPOINTS.FILES}/product-files/extra/${fileId}`), {
    onError: async (err) => {
      await handleAxiosCsrfError(err)
    }
  })
}

export async function deleteProductFile(productId: number, fileType: 'logo' | 'banner' | 'agent'): Promise<any> {
  return apiCall(() => api.delete(`${API_ENDPOINTS.FILES}/product-files/${productId}/${fileType}`), {
    onError: async (err) => {
      await handleAxiosCsrfError(err)
    }
  })
}
