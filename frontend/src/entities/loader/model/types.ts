import { BaseEntity } from '@/shared/api'

/**
 * Agent interface - universal term for launchers, auto-updaters, IoT devices
 * Universal terminology for B2B/SaaS applications
 */
export interface Agent extends BaseEntity {
  name: string
  description: string
  status: 'active' | 'inactive' | 'maintenance' | 'testing'
  logo?: string | null
  banner?: string | null
  background?: string | null
  file?: string | null
  changelog?: string | null
  notifications?: string | null
  version: string
  downloads: number
  active_users: number
  last_update?: string | null
  assigned_products: number[]  // Universal name (formerly assigned_games)
  login_type?: string
  invite_code_required?: boolean
  custom_key_prefix?: string | null
  key_prefix_format?: string | null
}

/**
 * Backward compatibility alias
 * @deprecated Use Agent instead. Loader is kept for backward compatibility.
 */
export interface Loader extends Agent {
  assigned_games: number[]  // Backward compatibility alias for assigned_products
}

export interface AgentStats {
  total_agents: number
  active_agents: number
  inactive_agents: number
  maintenance_agents: number
  testing_agents: number
  total_downloads: number
  total_active_users: number
}

/**
 * Backward compatibility alias
 * @deprecated Use AgentStats instead
 */
export interface LoaderStats extends AgentStats {
  total_loaders: number
  active_loaders: number
  inactive_loaders: number
  maintenance_loaders: number
  testing_loaders: number
}

export interface AgentsResponse {
  agents: Agent[]
  success: boolean
}

/**
 * Backward compatibility alias
 * @deprecated Use AgentsResponse instead
 */
export interface LoadersResponse extends AgentsResponse {
  loaders: Agent[]  // Alias for agents
}

export interface AgentProductsResponse {
  products: any[]  // Universal name (formerly games)
  success: boolean
}

/**
 * Backward compatibility alias
 * @deprecated Use AgentProductsResponse instead
 */
export interface LoaderGamesResponse extends AgentProductsResponse {
  games: any[]  // Alias for products
}

export interface AgentStatsResponse {
  stats: AgentStats
  success: boolean
}

/**
 * Backward compatibility alias
 * @deprecated Use AgentStatsResponse instead
 */
export interface LoaderStatsResponse extends AgentStatsResponse {
  stats: LoaderStats
}

export interface CreateAgentData {
  name: string
  description: string
  status?: 'active' | 'inactive' | 'maintenance' | 'testing'
  version?: string
  changelog?: string
  notifications?: string
}

/**
 * Backward compatibility alias
 * @deprecated Use CreateAgentData instead
 */
export type CreateLoaderData = CreateAgentData

export interface UpdateAgentData {
  name?: string
  description?: string
  status?: 'active' | 'inactive' | 'maintenance' | 'testing'
  logo?: string | null
  banner?: string | null
  background?: string | null
  file?: string
  changelog?: string
  notifications?: string
  version?: string
}

/**
 * Backward compatibility alias
 * @deprecated Use UpdateAgentData instead
 */
export type UpdateLoaderData = UpdateAgentData

export interface AgentConfigData {
  login_type?: 'license_generation' | 'invite_code'
  invite_code_required?: boolean
  custom_key_prefix?: string
  key_prefix_format?: string
}

/**
 * Backward compatibility alias
 * @deprecated Use AgentConfigData instead
 */
export type LoaderConfigData = AgentConfigData
