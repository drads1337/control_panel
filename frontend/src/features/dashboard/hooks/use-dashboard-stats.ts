import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/app/providers/auth-provider'
import { getDashboardStats, type DashboardData } from '@/entities/dashboard'

export type { DashboardData }

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

      const data = await getDashboardStats()

      return data
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {

      if (error?.response?.status === 401 || 
          error?.response?.status === 403 || 
          error?.response?.status === 410) {
        return false
      }

      if (error?.response?.status === 429) {
        return false
      }

      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

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
