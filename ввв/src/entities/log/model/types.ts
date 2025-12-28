import { BaseEntity, PaginatedResponse } from '@/shared/api'

export interface Log extends BaseEntity {
  user_id: number | null
  username: string | null
  action: string
  ip_address: string | null
  country: string | null
  city: string | null
  details: string | null
  user_agent: string | null
}

export interface LogsResponse extends PaginatedResponse<Log> {
  logs: Log[]
}

export interface LogStats {
  overview: {
    total: number
    today: number
    week: number
    month: number
  }
  action_stats: Array<{ action: string; count: number }>
  ip_stats: Array<{ ip: string; count: number }>
  country_stats: Array<{ country: string; count: number }>
  daily_stats: Array<{ date: string; count: number }>
}

export interface ConnectionLog {
  id: number
  user_id: number | null
  username: string
  action: string
  status: string
  ip_address: string | null
  country: string | null
  city: string | null
  created_at: string | null
  details: string | null
  user_agent: string | null
  product: string
  user_key: string
  serial: string
  reason: string | null
}

export interface ConnectionLogsResponse extends PaginatedResponse<ConnectionLog> {
  logs: ConnectionLog[]
}

export interface ConnectionLogStats {
  overview: {
    total: number
    successful: number
    failed: number
    success_rate: number
  }
  daily_stats: Array<{ date: string; count: number }>
  top_error_reasons: Array<{ reason: string; count: number }>
}
