import { BaseEntity } from '@/shared/api'

// Game entity types
export interface Game extends BaseEntity {
  unique_id: string
  name: string
  description: string | null
  is_active: boolean
  status: string
  is_multi_app: boolean
  version: string
  downloads: number
  active_users: number
  logo?: string
  banner?: string
  backgrounds?: any
  file?: string
  changelog?: string
  notifications?: string
  prices?: any
  activeUsers?: number
  lastUpdate?: string
  // New fields for enhanced game management
  custom_key_prefix?: string
  key_prefix_format?: string
  login_type?: 'license_generation' | 'classic_login'
  invite_code_required?: boolean
  loader?: any
}

export interface GamesResponse {
  success: boolean
  games: Game[]
  total_count: number
  filter_type: string
}

export interface CreateGameData {
  name: string
  description?: string
  status?: 'active' | 'inactive' | 'maintenance' | 'testing'
  is_multi_app?: boolean
  version?: string
  custom_key_prefix?: string
  key_prefix_format?: string
  login_type?: 'license_generation' | 'invite_code'
  invite_code_required?: boolean
}

export interface UpdateGameData {
  name?: string
  description?: string
  version?: string
  is_multi_app?: boolean
  custom_key_prefix?: string
  key_prefix_format?: string
  login_type?: 'license_generation' | 'classic_login'
  invite_code_required?: boolean
}
