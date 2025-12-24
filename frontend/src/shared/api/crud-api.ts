import { enhancedApi as api } from './enhanced-client'
import { apiCall } from './api-wrapper'
import type { AxiosResponse } from 'axios'

/**
 * Generic CRUD API factory
 * Creates standard CRUD operations for any entity
 * 
 * @example
 * ```ts
 * const userApi = createCrudApi<User, CreateUserData, UpdateUserData>('/api/users')
 * 
 * // Usage:
 * const users = await userApi.getAll({ page: 1, per_page: 20 })
 * const user = await userApi.getById(1)
 * const newUser = await userApi.create({ username: 'john', email: 'john@example.com' })
 * const updated = await userApi.update(1, { email: 'newemail@example.com' })
 * await userApi.delete(1)
 * ```
 */
export function createCrudApi<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>>(
  endpoint: string,
  options?: {
    /**
     * Custom data extractor for GET operations
     * Default: (res) => res.data
     */
    extractData?: <R = T>(res: AxiosResponse<any>) => R
    
    /**
     * Custom data extractor for list operations
     * Default: (res) => res.data
     */
    extractListData?: <R = T[]>(res: AxiosResponse<any>) => R
    
    /**
     * Custom error handler
     */
    onError?: (error: unknown) => void
  }
) {
  const { extractData, extractListData, onError } = options || {}
  
  const defaultExtractData = <R = T>(res: AxiosResponse<any>): R => {
    return extractData ? extractData(res) : (res.data as R)
  }
  
  const defaultExtractListData = <R = T[]>(res: AxiosResponse<any>): R => {
    return extractListData ? extractListData(res) : (res.data as R)
  }

  return {
    /**
     * Get all items with optional pagination and filters
     */
    getAll: async (params?: Record<string, any>): Promise<T[]> => {
      return apiCall(
        () => api.get(endpoint, { params }),
        {
          extractData: defaultExtractListData,
          onError,
        }
      )
    },

    /**
     * Get a single item by ID
     */
    getById: async (id: number | string): Promise<T> => {
      return apiCall(
        () => api.get(`${endpoint}/${id}`),
        {
          extractData: defaultExtractData,
          onError,
        }
      )
    },

    /**
     * Create a new item
     */
    create: async (data: CreateDTO): Promise<T> => {
      return apiCall(
        () => api.post(endpoint, data),
        {
          extractData: defaultExtractData,
          onError,
        }
      )
    },

    /**
     * Update an existing item
     */
    update: async (id: number | string, data: UpdateDTO): Promise<T> => {
      return apiCall(
        () => api.put(`${endpoint}/${id}`, data),
        {
          extractData: defaultExtractData,
          onError,
        }
      )
    },

    /**
     * Delete an item by ID
     */
    delete: async (id: number | string): Promise<void> => {
      return apiCall(
        () => api.delete(`${endpoint}/${id}`),
        {
          onError,
        }
      )
    },

    /**
     * Partially update an item (PATCH)
     */
    patch: async (id: number | string, data: Partial<UpdateDTO>): Promise<T> => {
      return apiCall(
        () => api.patch(`${endpoint}/${id}`, data),
        {
          extractData: defaultExtractData,
          onError,
        }
      )
    },
  }
}

