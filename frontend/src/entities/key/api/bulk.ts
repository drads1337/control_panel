import { enhancedApi as api } from '@/lib/api/enhanced-client'
import { API_ENDPOINTS } from '@/lib/api/config'
import type { Agent } from '@/entities/agent';

export async function bulkDeleteKeysByFilters(

  filters: {
    product_id?: number;
    agent_id?: number;
    product_ids?: number[];
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
    product_id?: number;
    agent_id?: number;
    product_ids?: number[];
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
    product_id?: number;
    agent_id?: number;
    product_ids?: number[];
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
    product_id?: number;
    agent_id?: number;
    product_ids?: number[];
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

export async function bulkPauseKeys(productId: number): Promise<{ message: string }> {
  if (!productId || isNaN(productId) || productId <= 0) {
    throw new Error('Invalid product ID')
  }
  const response = await api.post(API_ENDPOINTS.KEYS_BULK_PAUSE_BY_PRODUCT, { product_id: productId })
  return response.data
}

export async function bulkActivateKeys(productId: number): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_ACTIVATE_BY_PRODUCT, { product_id: productId })
  return response.data
}

export async function bulkDeleteKeys(productId: number): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_DELETE_BY_PRODUCT, { product_id: productId })
  return response.data
}

export async function bulkAddHoursToKeys(productId: number, hours: number): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_ADD_HOURS_BY_PRODUCT, { product_id: productId, hours })
  return response.data
}

export async function bulkPauseAgentKeys(agentId: number, productIds: number[]): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_AGENT_PAUSE, { agent_id: agentId, product_ids: productIds })
  return response.data
}

export async function bulkActivateAgentKeys(agentId: number, productIds: number[]): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_AGENT_ACTIVATE, { agent_id: agentId, product_ids: productIds })
  return response.data
}

export async function bulkDeleteAgentKeys(agentId: number, productIds: number[]): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_AGENT_DELETE, { agent_id: agentId, product_ids: productIds })
  return response.data
}

export async function bulkAddHoursToAgentKeys(agentId: number, productIds: number[], hours: number): Promise<{ message: string }> {

  const response = await api.post(API_ENDPOINTS.KEYS_BULK_AGENT_ADD_HOURS, { agent_id: agentId, product_ids: productIds, hours })
  return response.data
}
