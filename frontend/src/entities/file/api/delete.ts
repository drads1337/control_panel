import { enhancedApi as api } from '@/lib/api/enhanced-client'
import { API_ENDPOINTS } from '@/lib/api/config'
import { apiCall } from '@/lib/api/api-wrapper'
import { handleAxiosCsrfError } from '@/lib/csrf'

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
