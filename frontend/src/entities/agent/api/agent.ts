import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
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
  try {
    const response = await api.post(API_ENDPOINTS.AGENTS, data)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create agent')
  }
}

export async function updateAgent(agentId: number, data: UpdateAgentData): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.put(`${API_ENDPOINTS.AGENTS}/${agentId}`, data)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update agent')
  }
}

export async function deleteAgent(agentId: number): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.delete(`${API_ENDPOINTS.AGENTS}/${agentId}`)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete agent')
  }
}

export async function assignProductsToAgent(agentId: number, productIds: number[]): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.post(`${API_ENDPOINTS.AGENTS}/${agentId}/assign-products`, { product_ids: productIds })
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to assign products to agent')
  }
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
  try {
    const response = await api.put(`${API_ENDPOINTS.AGENTS}/${agentId}/status`, { status })
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update agent status')
  }
}

export async function updateAgentConfig(agentId: number, config: AgentConfigData): Promise<{ success: boolean; message: string; config: any }> {
  try {
    const response = await api.put(`${API_ENDPOINTS.AGENTS}/${agentId}/config`, config)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update agent config')
  }
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
  try {
    const response = await api.post(`${API_ENDPOINTS.AGENTS}/${agentId}/download`)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to record agent download')
  }
}

export async function uploadAgentFiles(agentId: number, files: FormData): Promise<{ success: boolean; message: string; uploaded_files: Record<string, string> }> {
  try {
    const response = await api.post(`${API_ENDPOINTS.AGENTS}/${agentId}/files`, files)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to upload agent files')
  }
}

