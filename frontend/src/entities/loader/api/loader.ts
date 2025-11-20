import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { LoadersResponse, LoaderGamesResponse, CreateLoaderData, UpdateLoaderData, LoaderConfigData, Loader } from '@/entities/loader';
import type {
  LoadersResponse as LoaderTypesResponse,
  LoaderGamesResponse as LoaderGamesResponseType,
  LoaderStatsResponse as LoaderStatsResponseType,
  CreateLoaderData as CreateLoaderDataType,
  UpdateLoaderData as UpdateLoaderDataType,
  LoaderConfigData as LoaderConfigDataType,
  Agent,
  AgentsResponse,
  AgentProductsResponse,
  AgentStatsResponse,
  CreateAgentData,
  UpdateAgentData,
  AgentConfigData
} from '../model/types'

// Universal terminology functions (new)
export async function getAgents(): Promise<AgentsResponse> {
  const response = await api.get(API_ENDPOINTS.AGENTS)
  const data = response.data
  // Map loaders to agents if backend returns loaders (backward compatibility)
  if (data.loaders && !data.agents) {
    return {
      ...data,
      agents: data.loaders
    } as AgentsResponse
  }
  return data
}

// Backward compatibility alias
/** @deprecated Use getAgents instead. getLoaders is kept for backward compatibility. */
export async function getLoaders(): Promise<LoaderTypesResponse> {
  // Use new endpoint - it's registered on backend
  const result = await getAgents()
  return {
    ...result,
    loaders: result.agents
  }
}

export async function getAvailableProducts(): Promise<AgentProductsResponse> {
  const response = await api.get(API_ENDPOINTS.AGENTS_AVAILABLE_PRODUCTS)
  const data = response.data
  // Map games to products if backend returns games (backward compatibility)
  if (data.games && !data.products) {
    return {
      ...data,
      products: data.games
    } as AgentProductsResponse
  }
  return data
}

// Backward compatibility alias
export async function getAvailableGames(): Promise<LoaderGamesResponseType> {
  // Use new endpoint - it's registered on backend
  const result = await getAvailableProducts()
  return {
    ...result,
    games: result.products
  }
}

export async function createAgent(data: CreateAgentData): Promise<{ agent: any; success: boolean; message: string }> {
  try {
    const response = await api.post(API_ENDPOINTS.AGENTS, data)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create agent')
  }
}

// Backward compatibility alias
export async function createLoader(data: CreateLoaderData): Promise<{ loader: any; success: boolean; message: string }> {
  // Use new endpoint - it's registered on backend
  const result = await createAgent(data)
  return {
    ...result,
    loader: result.agent
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

// Backward compatibility alias
export async function updateLoader(loaderId: number, data: UpdateLoaderData): Promise<{ success: boolean; message: string }> {
  // Use new endpoint - it's registered on backend
  return await updateAgent(loaderId, data)
}

export async function deleteAgent(agentId: number): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.delete(`${API_ENDPOINTS.AGENTS}/${agentId}`)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete agent')
  }
}

// Backward compatibility alias
export async function deleteLoader(loaderId: number): Promise<{ success: boolean; message: string }> {
  // Use new endpoint - it's registered on backend
  return await deleteAgent(loaderId)
}

export async function assignProductsToAgent(agentId: number, productIds: number[]): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.post(`${API_ENDPOINTS.AGENTS}/${agentId}/assign-products`, { product_ids: productIds })
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to assign products to agent')
  }
}

// Backward compatibility alias
export async function assignGamesToLoader(loaderId: number, gameIds: number[]): Promise<{ success: boolean; message: string }> {
  // Use new endpoint - it's registered on backend
  return await assignProductsToAgent(loaderId, gameIds)
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

// Backward compatibility alias
export async function unassignGamesFromLoader(loaderId: number, gameIds: number[]): Promise<{ success: boolean; message: string }> {
  // Use new endpoint - it's registered on backend
  return await unassignProductsFromAgent(loaderId, gameIds)
}

export async function updateAgentStatus(agentId: number, status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.put(`${API_ENDPOINTS.AGENTS}/${agentId}/status`, { status })
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update agent status')
  }
}

// Backward compatibility alias
export async function updateLoaderStatus(loaderId: number, status: 'active' | 'inactive' | 'maintenance' | 'testing'): Promise<{ success: boolean; message: string }> {
  // Use new endpoint - it's registered on backend
  return await updateAgentStatus(loaderId, status)
}

export async function updateAgentConfig(agentId: number, config: AgentConfigData): Promise<{ success: boolean; message: string; config: any }> {
  try {
    const response = await api.put(`${API_ENDPOINTS.AGENTS}/${agentId}/config`, config)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update agent config')
  }
}

// Backward compatibility alias
export async function updateLoaderConfig(loaderId: number, config: LoaderConfigData): Promise<{ success: boolean; message: string; config: any }> {
  // Use new endpoint - it's registered on backend
  return await updateAgentConfig(loaderId, config)
}

export async function getAgentStats(): Promise<AgentStatsResponse> {
  const response = await api.get(API_ENDPOINTS.AGENTS_STATS)
  return response.data
}

// Backward compatibility alias
export async function getLoaderStats(): Promise<LoaderStatsResponseType> {
  // Use new endpoint - it's registered on backend
  const result = await getAgentStats()
  return {
    ...result,
    stats: {
      ...result.stats,
      total_loaders: result.stats.total_agents,
      active_loaders: result.stats.active_agents,
      inactive_loaders: result.stats.inactive_agents,
      maintenance_loaders: result.stats.maintenance_agents,
      testing_loaders: result.stats.testing_agents,
    }
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

// Backward compatibility alias
export async function recordLoaderDownload(loaderId: number): Promise<{ success: boolean; download_url?: string; filename?: string; downloads: number }> {
  // Use new endpoint - it's registered on backend
  return await recordAgentDownload(loaderId)
}

export async function uploadAgentFiles(agentId: number, files: FormData): Promise<{ success: boolean; message: string; uploaded_files: Record<string, string> }> {
  try {
    const response = await api.post(`${API_ENDPOINTS.AGENTS}/${agentId}/files`, files)
    return response.data
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to upload agent files')
  }
}

// Backward compatibility alias
export async function uploadLoaderFiles(loaderId: number, files: FormData): Promise<{ success: boolean; message: string; uploaded_files: Record<string, string> }> {
  // Use new endpoint - it's registered on backend
  return await uploadAgentFiles(loaderId, files)
}
