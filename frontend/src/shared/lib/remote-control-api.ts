import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { apiCall } from '@/shared/api/api-wrapper'

// Types
export interface RemoteCategory {
  id: string
  name: string
  description: string
  color: string
  product_id: string
  created_at?: string
  updated_at?: string
}

export interface RemoteFeature {
  id: string
  name: string
  description: string
  enabled: boolean
  category: string // category_id as string
  product_id: string
  status: string
  configuration?: Record<string, any>
  usage_count?: number
  last_used_at?: string
  created_at?: string
  updated_at?: string
}

export interface CategoryStats {
  category_id: string
  category_name: string
  total_features: number
  enabled_features: number
  disabled_features: number
}

export interface CreateCategoryData {
  name: string
  description: string
  color: string
  product_id: number
}

export interface UpdateCategoryData {
  name?: string
  description?: string
  color?: string
  product_id?: number
}

export interface CreateFeatureData {
  name: string
  description: string
  category_id: string
  enabled: boolean
  configuration?: Record<string, any>
  status?: string
}

export interface UpdateFeatureData {
  name?: string
  description?: string
  category_id?: string
  enabled?: boolean
  configuration?: Record<string, any>
  status?: string
}

// API Client
export const remoteControlAPI = {
  /**
   * Get all categories for a product
   */
  async getCategories(productId: number | string): Promise<RemoteCategory[]> {
    return apiCall(
      () => api.get(API_ENDPOINTS.REMOTE_CONTROL_CATEGORIES, {
        params: { product_id: productId }
      }),
      {
        extractData: (res) => res.data.categories || []
      }
    )
  },

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryData): Promise<RemoteCategory> {
    return apiCall(
      () => api.post(API_ENDPOINTS.REMOTE_CONTROL_CATEGORIES, data),
      {
        extractData: (res) => res.data.category || res.data
      }
    )
  },

  /**
   * Update a category
   */
  async updateCategory(categoryId: string, data: UpdateCategoryData): Promise<RemoteCategory> {
    return apiCall(
      () => api.put(`${API_ENDPOINTS.REMOTE_CONTROL_CATEGORIES}/${categoryId}`, data),
      {
        extractData: (res) => res.data.category || res.data
      }
    )
  },

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    return apiCall(
      () => api.delete(`${API_ENDPOINTS.REMOTE_CONTROL_CATEGORIES}/${categoryId}`)
    )
  },

  /**
   * Get all features for a product
   */
  async getFeatures(productId: number | string, categoryId?: number): Promise<RemoteFeature[]> {
    const params: Record<string, any> = { product_id: productId }
    if (categoryId) {
      params.category_id = categoryId
    }
    
    return apiCall(
      () => api.get(API_ENDPOINTS.REMOTE_CONTROL_FEATURES, { params }),
      {
        extractData: (res) => res.data.features || []
      }
    )
  },

  /**
   * Create a new feature
   */
  async createFeature(data: CreateFeatureData): Promise<RemoteFeature> {
    return apiCall(
      () => api.post(API_ENDPOINTS.REMOTE_CONTROL_FEATURES, data),
      {
        extractData: (res) => res.data.feature || res.data
      }
    )
  },

  /**
   * Update a feature
   */
  async updateFeature(featureId: string, data: UpdateFeatureData): Promise<RemoteFeature> {
    return apiCall(
      () => api.put(`${API_ENDPOINTS.REMOTE_CONTROL_FEATURES}/${featureId}`, data),
      {
        extractData: (res) => res.data.feature || res.data
      }
    )
  },

  /**
   * Delete a feature
   */
  async deleteFeature(featureId: string): Promise<void> {
    return apiCall(
      () => api.delete(`${API_ENDPOINTS.REMOTE_CONTROL_FEATURES}/${featureId}`)
    )
  },

  /**
   * Toggle a feature on/off
   */
  async toggleFeature(featureId: string): Promise<RemoteFeature> {
    return apiCall(
      () => api.post(`${API_ENDPOINTS.REMOTE_CONTROL_FEATURES}/${featureId}/toggle`),
      {
        extractData: (res) => res.data.feature || res.data
      }
    )
  },

  /**
   * Get statistics for a product
   */
  async getStats(productId: number | string): Promise<CategoryStats[]> {
    return apiCall(
      () => api.get(API_ENDPOINTS.REMOTE_CONTROL_STATS, {
        params: { product_id: productId }
      }),
      {
        extractData: (res) => res.data.stats || []
      }
    )
  }
}

