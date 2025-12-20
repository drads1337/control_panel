import { BaseEntity } from '@/lib/api'

/**
 * Agent interface - universal term for launchers, auto-updaters, IoT devices
 * Universal terminology for B2B/SaaS products
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
  assigned_products: number[]  // Universal name (formerly assigned_products)
  login_type?: string
  invite_code_required?: boolean
  custom_key_prefix?: string | null
  key_prefix_format?: string | null
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

export interface AgentsResponse {
  agents: Agent[]
  success: boolean
}

export interface AgentProductsResponse {
  products: any[]  // Universal name (formerly products)
  success: boolean
}

export interface AgentStatsResponse {
  stats: AgentStats
  success: boolean
}

export interface CreateAgentData {
  name: string
  description: string
  status?: 'active' | 'inactive' | 'maintenance' | 'testing'
  version?: string
  changelog?: string
  notifications?: string
}

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

export interface AgentConfigData {
  login_type?: 'license_generation' | 'invite_code'
  invite_code_required?: boolean
  custom_key_prefix?: string
  key_prefix_format?: string
}
