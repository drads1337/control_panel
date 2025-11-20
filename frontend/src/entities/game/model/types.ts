import { BaseEntity } from '@/shared/api'

/**
 * Product interface - universal term for applications, software, or games
 * Universal terminology for B2B/SaaS applications
 */
export interface Product extends BaseEntity {
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

  custom_key_prefix?: string
  key_prefix_format?: string
  login_type?: 'license_generation' | 'classic_login'
  invite_code_required?: boolean
  loader?: any
}

/**
 * Backward compatibility alias
 * @deprecated Use Product instead. Game is kept for backward compatibility.
 */
export type Game = Product

export interface ProductsResponse {
  success: boolean
  products: Product[]
  total_count: number
  filter_type: string
}

/**
 * Backward compatibility alias
 * @deprecated Use ProductsResponse instead
 */
export interface GamesResponse extends ProductsResponse {
  games: Product[]  // Alias for products
}

export interface CreateProductData {
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

/**
 * Backward compatibility alias
 * @deprecated Use CreateProductData instead
 */
export type CreateGameData = CreateProductData

export interface UpdateProductData {
  name?: string
  description?: string
  version?: string
  is_multi_app?: boolean
  custom_key_prefix?: string
  key_prefix_format?: string
  login_type?: 'license_generation' | 'classic_login'
  invite_code_required?: boolean
}

/**
 * Backward compatibility alias
 * @deprecated Use UpdateProductData instead
 */
export type UpdateGameData = UpdateProductData
