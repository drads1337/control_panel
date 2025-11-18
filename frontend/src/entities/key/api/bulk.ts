import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { Loader } from '@/entities/loader';

export async function bulkDeleteKeysByFilters(

  filters: {
    game_id?: number;
    loader_id?: number;
    game_ids?: number[];
    status?: string;
    activation_status?: string;
    date_from?: string;
    date_to?: string;
    device_usage?: string;
    max_devices?: string;
  }
): Promise<{ message: string; deleted_count: number }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_DELETE_BY_FILTERS, filters)
  return response.data
}

export async function bulkResetKeysByFilters(

  filters: {
    game_id?: number;
    loader_id?: number;
    game_ids?: number[];
    status?: string;
    activation_status?: string;
    date_from?: string;
    date_to?: string;
    device_usage?: string;
    max_devices?: string;
  }
): Promise<{ message: string; reset_count: number }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_RESET_BY_FILTERS, filters)
  return response.data
}

export async function bulkExtendKeysByFilters(

  hours: number,
  filters: {
    game_id?: number;
    loader_id?: number;
    game_ids?: number[];
    status?: string;
    activation_status?: string;
    date_from?: string;
    date_to?: string;
    device_usage?: string;
    max_devices?: string;
  }
): Promise<{ message: string; extended_count: number }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_EXTEND_BY_FILTERS, { ...filters, hours })
  return response.data
}

export async function getKeysCountByFilters(

  filters: {
    game_id?: number;
    loader_id?: number;
    game_ids?: number[];
    status?: string;
    activation_status?: string;
    date_from?: string;
    date_to?: string;
    device_usage?: string;
    max_devices?: string;
  }
): Promise<{ count: number; breakdown: any }> {
  const params: Record<string, any> = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') {
      if (Array.isArray(value)) {
        params[key] = value
      } else {
        params[key] = value.toString()
      }
    }
  })

  const response = await api.get(API_ENDPOINTS.KEYS_COUNT_BY_FILTERS, { params })
  return response.data
}

export async function bulkPauseKeys(gameId: number): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_PAUSE, { game_id: gameId })
  return response.data
}

export async function bulkActivateKeys(gameId: number): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_ACTIVATE, { game_id: gameId })
  return response.data
}

export async function bulkDeleteKeys(gameId: number): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_DELETE, { game_id: gameId })
  return response.data
}

export async function bulkAddHoursToKeys(gameId: number, hours: number): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_ADD_HOURS, { game_id: gameId, hours })
  return response.data
}

export async function bulkPauseLoaderKeys(loaderId: number, gameIds: number[]): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_LOADER_PAUSE, { loader_id: loaderId, game_ids: gameIds })
  return response.data
}

export async function bulkActivateLoaderKeys(loaderId: number, gameIds: number[]): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_LOADER_ACTIVATE, { loader_id: loaderId, game_ids: gameIds })
  return response.data
}

export async function bulkDeleteLoaderKeys(loaderId: number, gameIds: number[]): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_LOADER_DELETE, { loader_id: loaderId, game_ids: gameIds })
  return response.data
}

export async function bulkAddHoursToLoaderKeys(loaderId: number, gameIds: number[], hours: number): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_LOADER_ADD_HOURS, { loader_id: loaderId, game_ids: gameIds, hours })
  return response.data
}
