// Base API response types
export interface BaseResponse {
  success?: boolean
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  pages: number
  current_page: number
  per_page: number
}

export interface ApiError {
  error: string
  details?: any
}

// Common filter types
export interface BaseFilters {
  page?: number
  per_page?: number
  search?: string
}

export interface DateFilters {
  date_from?: string
  date_to?: string
}

export interface StatusFilters {
  status?: string
}

// File upload types
export interface FileUploadResponse {
  success: boolean
  message: string
  file_url?: string
  file_id?: number
}

export interface BulkOperationResponse {
  message: string
  affected_count: number
}

// Common entity fields
export interface BaseEntity {
  id: number
  created_at: string | null
  updated_at?: string | null
}

export interface NamedEntity extends BaseEntity {
  name: string
  description?: string | null
}

export interface StatusEntity extends NamedEntity {
  status: string
  is_active: boolean
}
