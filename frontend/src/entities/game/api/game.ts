import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { GamesResponse, CreateGameData, UpdateGameData, Game } from '@/entities/game';
import type {
  GamesResponse as GameTypesResponse,
  CreateGameData as GameCreateData,
  UpdateGameData as GameUpdateData,
  Game as GameType,
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
    // Map games to products if backend returns games (backward compatibility)
    if (data.games && !data.products) {
      return {
        ...data,
        products: data.games
      } as ProductsResponse
    }
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

// Backward compatibility alias
/** @deprecated Use getProducts instead. getGames is kept for backward compatibility. */
export async function getGames(type: string = 'all'): Promise<GameTypesResponse> {
  // Use new endpoint - it's registered on backend
  const result = await getProducts(type);
  return {
    ...result,
    games: result.products  // Map products to games for backward compatibility
  } as GameTypesResponse;
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
    // Map games to products if backend returns games (backward compatibility)
    if (data.games && !data.products) {
      return {
        ...data,
        products: data.games
      }
    }
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

// Backward compatibility alias
export async function getGamesAvailableForAssignment(
  page: number = 1,
  perPage: number = 50
): Promise<{
  success: boolean
  games: GameType[]
  total_count: number
  page: number
  per_page: number
  total_pages: number
}> {
  // Use new endpoint - it's registered on backend
  const result = await getProductsAvailableForAssignment(page, perPage)
  return {
    ...result,
    games: result.products as GameType[]
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

// Backward compatibility alias
export async function createGame(data: GameCreateData): Promise<{ success: boolean; message: string; game: GameType }> {
  // Use new endpoint - it's registered on backend
  const result = await createProduct(data)
  return {
    ...result,
    game: result.product as GameType
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

// Backward compatibility alias
export async function updateGame(gameId: number, data: GameUpdateData): Promise<GameType> {
  // Use new endpoint - it's registered on backend
  return await updateProduct(gameId, data) as GameType
}

export async function deleteProduct(productId: number): Promise<void> {
  try {
    await api.delete(`${API_ENDPOINTS.PRODUCTS}/${productId}`)
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete product')
  }
}

// Backward compatibility alias
export async function deleteGame(gameId: number): Promise<void> {
  // Use new endpoint - it's registered on backend
  await deleteProduct(gameId)
}

export async function updateProductStatus(productId: number, status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<void> {
  try {
    await api.put(`${API_ENDPOINTS.PRODUCTS}/${productId}/status`, { status })
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update product status')
  }
}

// Backward compatibility alias
export async function updateGameStatus(gameId: number, status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<void> {
  // Use new endpoint - it's registered on backend
  await updateProductStatus(gameId, status)
}

export async function bulkUpdateProductStatus(productIds: number[], status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<void> {
  try {
    await api.put('/api/products/bulk-status', { product_ids: productIds, status })
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to bulk update product status')
  }
}

// Backward compatibility alias
export async function bulkUpdateGameStatus(gameIds: number[], status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<void> {
  // Use new endpoint - it's registered on backend
  await bulkUpdateProductStatus(gameIds, status)
}

export async function bulkDeleteProducts(productIds: number[]): Promise<void> {
  try {
    await api.delete('/api/products/bulk-delete', { data: { product_ids: productIds } })
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to bulk delete products')
  }
}

// Backward compatibility alias
export async function bulkDeleteGames(gameIds: number[]): Promise<void> {
  // Use new endpoint - it's registered on backend
  await bulkDeleteProducts(gameIds)
}

export interface ClassicUser {
  id: number
  username: string
  has_access: boolean
  can_generate_keys?: boolean
}

export interface ClassicUsersResponse {
  users: ClassicUser[]
  product_id: number  // Universal name
  product_name: string  // Universal name
  game_id: number  // Backward compatibility alias
  game_name: string  // Backward compatibility alias
}

export async function getProductClassicUsers(productId: number): Promise<ClassicUsersResponse> {
  try {
    const response = await api.get(`${API_ENDPOINTS.PRODUCTS}/${productId}/classic-users`)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to fetch classic users')
  }
}

// Backward compatibility alias
export async function getGameClassicUsers(gameId: number): Promise<ClassicUsersResponse> {
  // Use new endpoint - it's registered on backend
  const result = await getProductClassicUsers(gameId)
  return {
    ...result,
    game_id: result.product_id,
    game_name: result.product_name
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

// Backward compatibility alias
export async function toggleUserGameAccess(userId: number, gameId: number): Promise<{ has_access: boolean }> {
  // Use new endpoint - it's registered on backend
  return await toggleUserProductAccess(userId, gameId)
}
