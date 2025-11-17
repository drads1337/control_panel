import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { ApiMetrics } from '../model/types'

export interface DashboardData {
  overview: {
    users: {
      total: number
      active: number
      new_today: number
      new_week: number
    }
    keys: {
      total: number
      active: number
      expired: number
      created_today: number
      created_week: number
    }
    games: {
      total: number
      active: number
    }
    servers: {
      total: number
      online: number
      offline: number
      uptime_rate: number
    }
    activity: {
      total: number
      today: number
      week: number
    }
  }
  daily_stats: Array<{
    date: string
    users: number
    keys: number
    activity: number
  }>
  top_users: Array<{
    username: string
    activities: number
  }>
  top_games: Array<{
    game: string
    keys: number
  }>
  announcements: Array<{
    id: number
    title: string
    content: string
    created_at: string
  }>
  slow_queries?: {
    summary: {
      total_queries: number
      slow_queries: number
      avg_query_time_ms: number
      max_query_time_ms: number
      slow_query_ratio: number
      threshold_ms: number
    }
    recent_slow_queries: Array<{
      timestamp: string
      duration_ms: number
      query_type: string
      tables: string[]
      endpoint?: string
      statement_preview: string
    }>
    top_slow_patterns: Array<{
      fingerprint: string
      sample_query: string
      count: number
      avg_duration_ms: number
      max_duration_ms: number
      tables: string[]
    }>
  }
}

// Dashboard API functions
// All functions use centralized axios instance with CSRF protection
export async function getApiMetrics(): Promise<ApiMetrics> {
  // CSRF token and credentials are automatically handled by axios interceptors
  const response = await api.get(API_ENDPOINTS.DASHBOARD_API_METRICS)
  return response.data
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardData> {
  const response = await api.get(API_ENDPOINTS.DASHBOARD_STATS)
  return response.data
}
