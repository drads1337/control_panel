import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'
import { getDashboardStats, type DashboardData } from '@/entities/dashboard'

export type { DashboardData }

// Cache keys for dashboard stats
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
}

export interface UseDashboardStatsReturn {
  data: DashboardData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useDashboardStats(): UseDashboardStatsReturn {
  const { isAuthenticated, user } = useAuthContext()

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async () => {
      console.log('🔧 DASHBOARD: Fetching stats for user:', user?.username)
      const data = await getDashboardStats()
      console.log('🔧 DASHBOARD: Successfully fetched stats')
      return data
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes - dashboard stats don't need to be super fresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors (401, 403, 410)
      if (error?.response?.status === 401 || 
          error?.response?.status === 403 || 
          error?.response?.status === 410) {
        return false
      }
      // Don't retry on rate limit errors - user should manually retry
      if (error?.response?.status === 429) {
        return false
      }
      // Retry up to 2 times for other errors
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  // Convert error to string for compatibility
  const errorMessage = error
    ? (error as any)?.response?.data?.message || 
      (error as any)?.message || 
      'Failed to load dashboard data'
    : null

  return {
    data: data || null,
    loading: isLoading,
    error: errorMessage,
    refetch,
  }
}
