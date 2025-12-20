import { BaseEntity } from '@/lib/api'

/**
 * Product interface - universal term for products, software, or products
 * Universal terminology for B2B/SaaS products
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
  agent?: any
}

export interface ProductsResponse {
  success: boolean
  products: Product[]
  total_count: number
  filter_type: string
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
