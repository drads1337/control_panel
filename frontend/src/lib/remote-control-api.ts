import { enhancedApi as apiClient } from '@/lib/api/enhanced-client'

/**
 * Remote Control API Types
 */

export interface RemoteCategory {
  id: string
  name: string
  description: string | null
  color: string
  product_id: string
  created_at?: string
  updated_at?: string
}

export interface RemoteFeature {
  id: string
  name: string
  description: string | null
  enabled: boolean
  category: string // category_id as string
  product_id: string
  status: string
  configuration?: Record<string, any>
  usage_count?: number
  last_used_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface CategoryStats {
  category: RemoteCategory
  enabled: number
  total: number
}

export interface CreateCategoryRequest {
  name: string
  description?: string
  color?: string
  product_id: number
}

export interface UpdateCategoryRequest {
  name?: string
  description?: string
  color?: string
  product_id?: number
}

export interface CreateFeatureRequest {
  name: string
  description?: string
  category_id: string
  enabled?: boolean
  status?: string
  configuration?: Record<string, any>
}

export interface UpdateFeatureRequest {
  name?: string
  description?: string
  category_id?: string
  enabled?: boolean
  status?: string
  configuration?: Record<string, any>
}

/**
 * Remote Control API Client
 */
class RemoteControlAPI {
  /**
   * Get all categories for a product
   */
  async getCategories(productId: number): Promise<RemoteCategory[]> {
    const response = await apiClient.get('/api/remote-control/categories', {
      params: { product_id: productId },
    })
    return response.data.categories || []
  }

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryRequest): Promise<RemoteCategory> {
    const response = await apiClient.post('/api/remote-control/categories', data)
    return response.data.category
  }

  /**
   * Update a category
   */
  async updateCategory(
    categoryId: string,
    data: UpdateCategoryRequest
  ): Promise<RemoteCategory> {
    const response = await apiClient.put(`/api/remote-control/categories/${categoryId}`, data)
    return response.data.category
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/remote-control/categories/${categoryId}`)
    return response.data
  }

  /**
   * Get all features for a product
   */
  async getFeatures(productId: number, categoryId?: number): Promise<RemoteFeature[]> {
    const params: any = { product_id: productId }
    if (categoryId) {
      params.category_id = categoryId
    }
    const response = await apiClient.get('/api/remote-control/features', { params })
    return response.data.features || []
  }

  /**
   * Create a new feature
   */
  async createFeature(data: CreateFeatureRequest): Promise<RemoteFeature> {
    const response = await apiClient.post('/api/remote-control/features', data)
    return response.data.feature
  }

  /**
   * Update a feature
   */
  async updateFeature(
    featureId: string,
    data: UpdateFeatureRequest
  ): Promise<RemoteFeature> {
    const response = await apiClient.put(`/api/remote-control/features/${featureId}`, data)
    return response.data.feature
  }

  /**
   * Delete a feature
   */
  async deleteFeature(featureId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/remote-control/features/${featureId}`)
    return response.data
  }

  /**
   * Toggle a feature on/off
   */
  async toggleFeature(featureId: string): Promise<RemoteFeature> {
    const response = await apiClient.post(`/api/remote-control/features/${featureId}/toggle`)
    return response.data.feature
  }

  /**
   * Get statistics for categories
   */
  async getStats(productId: number): Promise<CategoryStats[]> {
    const response = await apiClient.get('/api/remote-control/stats', {
      params: { product_id: productId },
    })
    return response.data.stats || []
  }
}

export const remoteControlAPI = new RemoteControlAPI()

