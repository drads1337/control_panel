import { BaseEntity } from '@/shared/api'

export interface Loader extends BaseEntity {
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
  assigned_games: number[]
  login_type?: string
  invite_code_required?: boolean
  custom_key_prefix?: string | null
  key_prefix_format?: string | null
}

export interface LoaderStats {
  total_loaders: number
  active_loaders: number
  inactive_loaders: number
  maintenance_loaders: number
  testing_loaders: number
  total_downloads: number
  total_active_users: number
}

export interface LoadersResponse {
  loaders: Loader[]
  success: boolean
}

export interface LoaderGamesResponse {
  games: any[]
  success: boolean
}

export interface LoaderStatsResponse {
  stats: LoaderStats
  success: boolean
}

export interface CreateLoaderData {
  name: string
  description: string
  status?: 'active' | 'inactive' | 'maintenance' | 'testing'
  version?: string
  changelog?: string
  notifications?: string
}

export interface UpdateLoaderData {
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

export interface LoaderConfigData {
  login_type?: 'license_generation' | 'invite_code'
  invite_code_required?: boolean
  custom_key_prefix?: string
  key_prefix_format?: string
}
