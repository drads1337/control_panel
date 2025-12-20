import { enhancedApi as api } from '@/lib/api/enhanced-client'
import { API_ENDPOINTS } from '@/lib/api/config'
import { apiCall } from '@/lib/api/api-wrapper'
import type {
  Product,
  ProductsResponse,
  CreateProductData,
  UpdateProductData
} from '../model/types'

// Universal terminology functions (new)
export async function getProductsCount(type: string = 'all'): Promise<{ success: boolean; count: number }> {
  const params: any = { type, _t: Date.now().toString() }
  return apiCall(() => api.get(API_ENDPOINTS.PRODUCTS_COUNT, { params }))
}

export async function getProducts(type: string = 'all'): Promise<ProductsResponse> {
  const params: any = { type, _t: Date.now().toString() }
  return apiCall(() => api.get(API_ENDPOINTS.PRODUCTS, { params }))
}

export async function getProductsAvailableForAssignment(
  page: number = 1,
  perPage: number = 50
): Promise<{
  success: boolean
  products: Product[]
  total_count: number
  page: number
  per_page: number
  total_pages: number
}> {
  const params = {
    page: page.toString(),
    per_page: perPage.toString(),
  }
  return apiCall(() => api.get(API_ENDPOINTS.PRODUCTS_AVAILABLE_FOR_ASSIGNMENT, { params }))
}

export async function createProduct(data: CreateProductData): Promise<{ success: boolean; message: string; product: Product }> {
  return apiCall(() => api.post(API_ENDPOINTS.PRODUCTS, data))
}

export async function updateProduct(productId: number, data: UpdateProductData): Promise<Product> {
  return apiCall(() => api.put(`${API_ENDPOINTS.PRODUCTS}/${productId}`, data), {
    extractData: (res) => res.data.product || res.data
  })
}

export async function deleteProduct(productId: number): Promise<void> {
  return apiCall(() => api.delete(`${API_ENDPOINTS.PRODUCTS}/${productId}`))
}

export async function updateProductStatus(productId: number, status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<void> {
  return apiCall(() => api.put(`${API_ENDPOINTS.PRODUCTS}/${productId}/status`, { status }))
}

export async function bulkUpdateProductStatus(productIds: number[], status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<void> {
  return apiCall(() => api.put('/api/products/bulk-status', { product_ids: productIds, status }))
}

export async function bulkDeleteProducts(productIds: number[]): Promise<void> {
  return apiCall(() => api.delete('/api/products/bulk-delete', { data: { product_ids: productIds } }))
}

export interface ClassicUser {
  id: number
  username: string
  has_access: boolean
  can_generate_keys?: boolean
}

export interface ClassicUsersResponse {
  users: ClassicUser[]
  product_id: number
  product_name: string
}

export async function getProductClassicUsers(productId: number): Promise<ClassicUsersResponse> {
  return apiCall(() => api.get(`${API_ENDPOINTS.PRODUCTS}/${productId}/classic-users`))
}

export async function toggleUserProductAccess(userId: number, productId: number): Promise<{ has_access: boolean }> {
  return apiCall(() => api.post(`/api/users/${userId}/products/${productId}/toggle`))
}

