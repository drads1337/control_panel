import { BaseEntity, PaginatedResponse } from '@/lib/api'

export interface Project extends BaseEntity {
  unique_id: string
  name: string
  description: string | null
  admin_id: number | null
  status: string
  subscription_status: string
  subscription_expires_at: string | null
  days_until_expiry: number | null
  is_active: boolean
  subscription_status_display: string
  storage_limit_gb: number
  stats: {
    users: number
    keys: number
    products: number
    servers: number
  }
}

export interface ProjectsResponse extends PaginatedResponse<Project> {
  projects: Project[]
}

export interface CreateProjectData {
  name: string
  description?: string
  admin_id?: number
  status?: string
  subscription_days?: number
  storage_limit_gb?: number
}
