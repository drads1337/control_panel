import { BaseEntity } from '@/shared/api'

// File entity types
export interface FileItem {
  id: string
  config_id?: string  // 8-digit ID for configs
  name: string
  type: 'file' | 'folder'
  size: number
  path: string
  modified: string
  status: 'active' | 'inactive' | 'archived'
  gameId?: number
  category: 'config' | 'resource' | 'game' | 'other' | 'logo' | 'banner' | 'loader' | 'folder'
  description?: string
  version?: string
  download_count?: number
  rating?: number
}

export interface GameFileStats {
  overview: {
    total_configs: number
    total_extra_files: number
    total_files: number
    total_size: number
    total_size_human: string
  }
  config_types: Record<string, number>
  extra_types: Record<string, number>
  recent_uploads: Array<{
    name: string
    type: 'config' | 'extra'
    uploaded_at: string
    size: number
  }>
}

export interface FileStats {
  overview: {
    total_files: number
    total_size: number
    total_size_human: string
  }
  storage_info: {
    storage_limit: number | null
    storage_limit_human: string | null
    available_space: number
    available_space_human: string | null
    usage_percent: number
  }
  type_stats: Array<{
    type: string
    count: number
  }>
  size_stats: {
    small: number
    medium: number
    large: number
  }
}

export interface CreateFolderData {
  name: string
  parent_path?: string
  game_id?: number
}
