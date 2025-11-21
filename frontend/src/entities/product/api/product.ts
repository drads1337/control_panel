import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type {
  Product,
  ProductsResponse,
  CreateProductData,
  UpdateProductData
} from '../model/types'

// Universal terminology functions (new)
export async function getProducts(type: string = 'all'): Promise<ProductsResponse> {
  try {
    const params: any = { type, _t: Date.now().toString() }
    const response = await api.get(API_ENDPOINTS.PRODUCTS, { params })
    const data = response.data
    return data
  } catch (err: any) {
    if (err.response?.status === 402) {
      const error = new Error(`PAYMENT REQUIRED`)
      ;(error as any).status = 402
      ;(error as any).data = err.response?.data
      throw error
    }
    if (err.response?.status === 429) {
      const error = new Error(`TOO MANY REQUESTS`)
      ;(error as any).status = 429
      throw error
    }
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch products')
  }
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
  try {
    const params = {
      page: page.toString(),
      per_page: perPage.toString(),
    }
    const response = await api.get(API_ENDPOINTS.PRODUCTS_AVAILABLE_FOR_ASSIGNMENT, { params })
    const data = response.data
    return data
  } catch (err: any) {
    if (err.response?.status === 402) {
      const error = new Error('PAYMENT REQUIRED')
      ;(error as any).status = 402
      ;(error as any).data = err.response?.data
      throw error
    }
    if (err.response?.status === 429) {
      const error = new Error('TOO MANY REQUESTS')
      ;(error as any).status = 429
      throw error
    }
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch available products')
  }
}

export async function createProduct(data: CreateProductData): Promise<{ success: boolean; message: string; product: Product }> {
  try {
    const response = await api.post(API_ENDPOINTS.PRODUCTS, data)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create product')
  }
}

export async function updateProduct(productId: number, data: UpdateProductData): Promise<Product> {
  try {
    const response = await api.put(`${API_ENDPOINTS.PRODUCTS}/${productId}`, data)
    return response.data.product || response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update product')
  }
}

export async function deleteProduct(productId: number): Promise<void> {
  try {
    await api.delete(`${API_ENDPOINTS.PRODUCTS}/${productId}`)
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete product')
  }
}

export async function updateProductStatus(productId: number, status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<void> {
  try {
    await api.put(`${API_ENDPOINTS.PRODUCTS}/${productId}/status`, { status })
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update product status')
  }
}

export async function bulkUpdateProductStatus(productIds: number[], status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<void> {
  try {
    await api.put('/api/products/bulk-status', { product_ids: productIds, status })
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to bulk update product status')
  }
}

export async function bulkDeleteProducts(productIds: number[]): Promise<void> {
  try {
    await api.delete('/api/products/bulk-delete', { data: { product_ids: productIds } })
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to bulk delete products')
  }
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
  try {
    const response = await api.get(`${API_ENDPOINTS.PRODUCTS}/${productId}/classic-users`)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to fetch classic users')
  }
}

export async function toggleUserProductAccess(userId: number, productId: number): Promise<{ has_access: boolean }> {
  try {
    const response = await api.post(`/api/users/${userId}/products/${productId}/toggle`)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to toggle user access')
  }
}

