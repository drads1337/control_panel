import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'
import { getApiUrl } from '@/shared/api'
import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { getLogs } from '@/entities/log'
import { projectKeys } from '@/entities/project'
import { logKeys } from './use-logs-query'

export interface OwnerDashboardStats {
  system_overview: {
    total_projects: number
    active_projects: number
    total_users: number
    active_users: number
    total_keys: number
    active_keys: number
    total_products: number
    total_servers: number
    online_servers: number
    system_uptime: number
    total_revenue: number
    monthly_revenue: number
  }
  project_analytics: Array<{
    project_id: number
    project_name: string
    users_count: number
    keys_count: number
    products_count: number
    servers_count: number
    status: string
    subscription_status: string
    created_at: string
    last_activity: string
  }>
  user_analytics: {
    by_role: Array<{ role: string; count: number }>
    by_status: Array<{ status: string; count: number }>
    new_today: number
    new_week: number
    new_month: number
  }
  revenue_analytics: {
    daily: Array<{ date: string; revenue: number }>
    monthly: Array<{ month: string; revenue: number }>
    by_project: Array<{ project: string; revenue: number }>
  }
  system_health: {
    cpu_usage: number
    memory_usage: number
    disk_usage: number
    network_status: string
    database_status: string
    redis_status: string
    last_backup: string
  }
  security_metrics: {
    failed_logins: number
    blocked_ips: number
    security_alerts: number
    two_factor_enabled: number
    last_security_scan: string
  }
  load_status?: {
    overall_status: 'normal' | 'warning' | 'critical'
    project_id: number | null
    endpoints: {
      connect: {
        endpoint: string
        requests_per_second: number
        total_requests: number
        error_count: number
        error_rate_percent: number
        response_time_ms: {
          avg: number
          p50: number
          p95: number
          p99: number
        }
        status: 'normal' | 'warning' | 'critical'
        severity: 'low' | 'medium' | 'high' | 'critical'
        recommendations?: string[]
      }
      heartbeat: {
        endpoint: string
        requests_per_second: number
        total_requests: number
        error_count: number
        error_rate_percent: number
        response_time_ms: {
          avg: number
          p50: number
          p95: number
          p99: number
        }
        status: 'normal' | 'warning' | 'critical'
        severity: 'low' | 'medium' | 'high' | 'critical'
        recommendations?: string[]
      }
    }
    timestamp: string
  }
}

export interface RecentSystemActivity {
  id: number
  type: 'user' | 'project' | 'system' | 'security'
  action: string
  details: string
  timestamp: string
  severity: 'info' | 'warning' | 'error' | 'critical'
}

export const ownerDashboardKeys = {
  all: ['owner-dashboard'] as const,
  overview: () => [...ownerDashboardKeys.all, 'overview'] as const,
  activity: () => [...ownerDashboardKeys.all, 'activity'] as const,
}

export interface UseOwnerDashboardReturn {
  stats: OwnerDashboardStats | null
  recentActivity: RecentSystemActivity[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useOwnerDashboard(): UseOwnerDashboardReturn {
  const { isAuthenticated, user } = useAuthContext()
  const isOwner = user?.roles?.includes('owner')

  const {
    data: overviewData,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ownerDashboardKeys.overview(),
    queryFn: async () => {
      const response = await api.get('/api/analytics/owner/dashboard/overview')
      return response.data.data as OwnerDashboardStats
    },
    enabled: isAuthenticated && !!isOwner,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  const {
    data: logsData,
    isLoading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ownerDashboardKeys.activity(),
    queryFn: async () => {
      const logsResponse = await getLogs(1, 20)
      return logsResponse.logs || []
    },
    enabled: isAuthenticated && !!isOwner,
    staleTime: 1 * 60 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  const recentActivity: RecentSystemActivity[] = (logsData || [])
    .slice(0, 10)
    .map((log: any) => ({
      id: log.id,
      type: log.action?.includes('project') ? 'project' as const : 
            log.action?.includes('user') ? 'user' as const :
            log.action?.includes('security') ? 'security' as const : 'system' as const,
      action: log.action || '',
      details: log.details || '',
      timestamp: log.created_at || '',
      severity: (log.action?.includes('error') ? 'error' :
                 log.action?.includes('warning') ? 'warning' : 'info') as 'info' | 'warning' | 'error' | 'critical'
    }))

  const loading = overviewLoading || logsLoading

  const error = overviewError || logsError
    ? (overviewError || logsError)?.message || 'Failed to load owner dashboard data'
    : null

  const refetch = () => {
    refetchOverview()
    refetchLogs()
  }

  return {
    stats: overviewData || null,
    recentActivity,
    loading,
    error,
    refetch,
  }
}
