import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import { apiCall } from '@/shared/api/api-wrapper'
import type {
  Agent,
  AgentsResponse,
  AgentProductsResponse,
  AgentStatsResponse,
  CreateAgentData,
  UpdateAgentData,
  AgentConfigData
} from '../model/types'

export async function getAgents(): Promise<AgentsResponse> {
  const response = await api.get(API_ENDPOINTS.AGENTS)
  return response.data
}

export async function getAvailableProducts(): Promise<AgentProductsResponse> {
  const response = await api.get(API_ENDPOINTS.AGENTS_AVAILABLE_PRODUCTS)
  return response.data
}

export async function createAgent(data: CreateAgentData): Promise<{ agent: any; success: boolean; message: string }> {
  return apiCall(() => api.post(API_ENDPOINTS.AGENTS, data))
}

export async function updateAgent(agentId: number, data: UpdateAgentData): Promise<{ success: boolean; message: string }> {
  return apiCall(() => api.put(`${API_ENDPOINTS.AGENTS}/${agentId}`, data))
}

export async function deleteAgent(agentId: number): Promise<{ success: boolean; message: string }> {
  return apiCall(() => api.delete(`${API_ENDPOINTS.AGENTS}/${agentId}`))
}

export async function assignProductsToAgent(agentId: number, productIds: number[]): Promise<{ success: boolean; message: string }> {
  // Ensure productIds is always a valid array (never undefined or null)
  const validProductIds = Array.isArray(productIds) ? productIds : []
  return apiCall(() => api.post(`${API_ENDPOINTS.AGENTS}/${agentId}/assign-products`, { 
    product_ids: validProductIds 
  }))
}

export async function unassignProductsFromAgent(agentId: number, productIds: number[]): Promise<{ success: boolean; message: string }> {
  const agentsResponse = await api.get(API_ENDPOINTS.AGENTS)
  const agentsData = agentsResponse.data
  const agent = agentsData.agents?.find((a: any) => a.id === agentId)

  if (!agent) {
    throw new Error('Agent not found')
  }

  const currentAssignedProducts = agent.assigned_products || []
  const updatedProductIds = currentAssignedProducts.filter((id: number) => !productIds.includes(id))

  return assignProductsToAgent(agentId, updatedProductIds)
}

export async function updateAgentStatus(agentId: number, status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<{ success: boolean; message: string }> {
  return apiCall(() => api.put(`${API_ENDPOINTS.AGENTS}/${agentId}/status`, { status }))
}

export async function updateAgentConfig(agentId: number, config: AgentConfigData): Promise<{ success: boolean; message: string; config: any }> {
  return apiCall(() => api.put(`${API_ENDPOINTS.AGENTS}/${agentId}/config`, config))
}

export async function getAgentStats(): Promise<AgentStatsResponse> {
  const response = await api.get(API_ENDPOINTS.AGENTS_STATS)
  return response.data
}


/**
 * Backward compatibility function that wraps getAgents() and returns data in the old format
 * Maps agents to agents and assigned_products to assigned_products
 */
export async function getAgentsLegacy(): Promise<{ agents: Agent[]; success: boolean }> {
  const response = await getAgents()
  // Map agents to agents format, converting assigned_products to assigned_products for compatibility
  const agents = response.agents.map(agent => ({
    ...agent,
    assigned_products: agent.assigned_products || []
  }))
  return {
    agents,
    success: response.success
  }
}

export async function recordAgentDownload(agentId: number): Promise<{ success: boolean; download_url?: string; filename?: string; downloads: number }> {
  return apiCall(() => api.post(`${API_ENDPOINTS.AGENTS}/${agentId}/download`))
}

export async function uploadAgentFiles(agentId: number, files: FormData): Promise<{ success: boolean; message: string; uploaded_files: Record<string, string> }> {
  return apiCall(() => api.post(`${API_ENDPOINTS.AGENTS}/${agentId}/files`, files))
}

// Library Hash Management API (reuse types from product)
export type { LibraryHash, LibraryHashSettings } from '@/entities/product/api/product'

export async function getAgentLibraryHashes(agentId: number | string): Promise<{ hashes: import('@/entities/product/api/product').LibraryHash[] }> {
  return apiCall(() => api.get(`${API_ENDPOINTS.AGENTS}/${agentId}/library-hashes`))
}

export async function addAgentLibraryHash(
  agentId: number | string,
  data: { hash_sha256: string; version?: string; description?: string }
): Promise<{ success: boolean; message: string; hash: import('@/entities/product/api/product').LibraryHash }> {
  return apiCall(() => api.post(`${API_ENDPOINTS.AGENTS}/${agentId}/library-hashes`, data))
}

export async function deleteAgentLibraryHash(
  agentId: number | string,
  hashId: number
): Promise<{ success: boolean; message: string }> {
  return apiCall(() => api.delete(`${API_ENDPOINTS.AGENTS}/${agentId}/library-hashes/${hashId}`))
}

export async function getAgentLibraryHashSettings(agentId: number | string): Promise<import('@/entities/product/api/product').LibraryHashSettings> {
  return apiCall(() => api.get(`${API_ENDPOINTS.AGENTS}/${agentId}/library-hash-settings`))
}

export async function updateAgentLibraryHashSettings(
  agentId: number | string,
  settings: import('@/entities/product/api/product').LibraryHashSettings
): Promise<{ success: boolean; message: string; settings: import('@/entities/product/api/product').LibraryHashSettings }> {
  return apiCall(() => api.put(`${API_ENDPOINTS.AGENTS}/${agentId}/library-hash-settings`, settings))
}

