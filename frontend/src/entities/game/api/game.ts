import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { GamesResponse, CreateGameData, UpdateGameData, Game } from '@/entities/game';
import type {
  GamesResponse as GameTypesResponse,
  CreateGameData as GameCreateData,
  UpdateGameData as GameUpdateData,
  Game as GameType
} from '../model/types'

// Game API functions
export async function getGames(type: string = 'all'): Promise<GameTypesResponse> {
  try {
    // Add timestamp to prevent browser caching
    const params: any = { type, _t: Date.now().toString() }
    
    const response = await api.get(API_ENDPOINTS.GAMES, { params })
    return response.data
  } catch (err: any) {
    // Handle payment required error
    if (err.response?.status === 402) {
      const error = new Error(`PAYMENT REQUIRED`)
      ;(error as any).status = 402
      ;(error as any).data = err.response?.data
      throw error
    }
    
    // Handle rate limiting error
    if (err.response?.status === 429) {
      const error = new Error(`TOO MANY REQUESTS`)
      ;(error as any).status = 429
      throw error
    }
    
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch games')
  }
}

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
  try {
    const params = {
      page: page.toString(),
      per_page: perPage.toString(),
    }
    
    const response = await api.get(API_ENDPOINTS.GAMES_AVAILABLE_FOR_ASSIGNMENT, { params })
    return response.data
  } catch (err: any) {
    // Handle payment required error
    if (err.response?.status === 402) {
      const error = new Error('PAYMENT REQUIRED')
      ;(error as any).status = 402
      ;(error as any).data = err.response?.data
      throw error
    }
    
    // Handle rate limiting error
    if (err.response?.status === 429) {
      const error = new Error('TOO MANY REQUESTS')
      ;(error as any).status = 429
      throw error
    }
    
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch available games')
  }
}

export async function createGame(data: GameCreateData): Promise<{ success: boolean; message: string; game: GameType }> {
  try {
    // CSRF token and credentials are automatically handled by axios interceptors in base.ts
    const response = await api.post(API_ENDPOINTS.GAMES, data)
    return response.data
  } catch (err: any) {
    console.error('[Game API] Exception caught:', err)
    // CSRF errors are handled by axios response interceptor in base.ts
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create game')
  }
}

export async function updateGame(gameId: number, data: GameUpdateData): Promise<GameType> {
  try {
    // CSRF token and credentials are automatically handled by axios interceptors in base.ts
    const response = await api.put(`${API_ENDPOINTS.GAMES}/${gameId}`, data)
    return response.data.game || response.data
  } catch (err: any) {
    console.error('[Game API] Exception caught:', err)
    // CSRF errors are handled by axios response interceptor in base.ts
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update game')
  }
}

export async function deleteGame(gameId: number): Promise<void> {
  try {
    // CSRF token and credentials are automatically handled by axios interceptors in base.ts
    await api.delete(`${API_ENDPOINTS.GAMES}/${gameId}`)
  } catch (err: any) {
    console.error('[Game API] Exception caught:', err)
    // CSRF errors are handled by axios response interceptor in base.ts
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete game')
  }
}

export async function updateGameStatus(gameId: number, status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<void> {
  try {
    // CSRF token and credentials are automatically handled by axios interceptors in base.ts
    await api.put(`${API_ENDPOINTS.GAMES}/${gameId}/status`, { status })
  } catch (err: any) {
    console.error('[Game API] Exception caught:', err)
    // CSRF errors are handled by axios response interceptor in base.ts
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update game status')
  }
}

export async function bulkUpdateGameStatus(gameIds: number[], status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<void> {
  try {
    // CSRF token and credentials are automatically handled by axios interceptors in base.ts
    await api.put('/api/games/bulk-status', { game_ids: gameIds, status })
  } catch (err: any) {
    console.error('[Game API] Exception caught:', err)
    // CSRF errors are handled by axios response interceptor in base.ts
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to bulk update game status')
  }
}

export async function bulkDeleteGames(gameIds: number[]): Promise<void> {
  try {
    // CSRF token and credentials are automatically handled by axios interceptors in base.ts
    await api.delete('/api/games/bulk-delete', { data: { game_ids: gameIds } })
  } catch (err: any) {
    console.error('[Game API] Exception caught:', err)
    // CSRF errors are handled by axios response interceptor in base.ts
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to bulk delete games')
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
  game_id: number
  game_name: string
}

/**
 * Get classic users for a specific game
 */
export async function getGameClassicUsers(gameId: number): Promise<ClassicUsersResponse> {
  try {
    const response = await api.get(`${API_ENDPOINTS.GAMES_CLASSIC_USERS}/${gameId}/classic-users`)
    return response.data
  } catch (err: any) {
    console.error('[Game API] Exception caught:', err)
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to fetch classic users')
  }
}

/**
 * Toggle user access to a game
 */
export async function toggleUserGameAccess(userId: number, gameId: number): Promise<{ has_access: boolean }> {
  try {
    const response = await api.post(`/api/users/${userId}/games/${gameId}/toggle`)
    return response.data
  } catch (err: any) {
    console.error('[Game API] Exception caught:', err)
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to toggle user access')
  }
}
