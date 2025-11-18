import { BaseEntity, PaginatedResponse } from '@/shared/api'

export interface LicenseKey extends BaseEntity {
  key: string
  user_id: number | null
  game_id: number | null
  game_name: string | null
  status: number
  is_active: boolean
  is_expired: boolean
  expires_at: string | null
  activated_at: string | null
  max_devices: number
  device_count: number
  duration_hours: number
  project_id: number
  fingerprint: string | null
  generation_type?: 'license_key' | 'access_code'
  is_access_code?: boolean
}

export interface LicenseKeysResponse extends PaginatedResponse<LicenseKey> {
  keys: LicenseKey[]
}

export interface CreateKeyData {
  duration_hours: number
  max_devices: number
  game_id: number
  custom_key?: string
}

export interface BulkCreateKeysData {
  count: number
  duration_hours: number
  max_devices: number
  game_id: number
}

export interface CreateLoaderKeyData {
  duration_hours: number
  max_devices: number
  loader_id: number
  game_ids: number[]
  custom_key?: string
}

export interface BulkCreateLoaderKeysData {
  count: number
  duration_hours: number
  max_devices: number
  loader_id: number
  game_ids: number[]
}

export interface KeysStats {
  total: number
  active: number
  expired: number
  inactive: number
}
