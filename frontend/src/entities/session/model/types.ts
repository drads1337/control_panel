import { BaseEntity, PaginatedResponse } from '@/shared/api'

export interface Session {
  user_id: number
  username: string
  last_login: string | null
  last_ip: string | null
  last_country: string | null
  last_city: string | null
  last_activity: string | null
  last_action: {
    action: string | null
    user_agent: string | null
  } | null
  session_duration: string | null
  is_active: boolean
}

export interface SessionsResponse extends PaginatedResponse<Session> {
  sessions: Session[]
}

export interface SessionStats {
  overview: {
    active_sessions: number
    today_sessions: number
    week_sessions: number
    month_sessions: number
  }
  hour_stats: Array<{ hour: number; count: number }>
  day_stats: Array<{ day: string; count: number }>
}

export interface SessionDetails {
  user: {
    id: number
    username: string
    last_login: string | null
    last_ip: string | null
    last_country: string | null
    last_city: string | null
  }
  session: {
    start: string | null
    end: string | null
    duration: string
    activity_count: number
  }
  activities: Array<{
    id: number
    action: string
    ip_address: string | null
    country: string | null
    city: string | null
    created_at: string | null
    details: string | null
    user_agent: string | null
  }>
}
