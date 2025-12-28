import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuthContext } from '@/app/providers/auth-provider'
import { getDashboardStats, type DashboardData } from '@/entities/dashboard'
import { createQueryRetry } from '@/shared/lib/query-retry-utils'
import { getErrorMessage } from '@/shared/api/api-error-types'

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
  const justAuthenticatedRef = useRef(false)
  const initialDelayRef = useRef(false)

  // Track when user becomes authenticated to add initial delay
  useEffect(() => {
    if (isAuthenticated && user?.id && !justAuthenticatedRef.current) {
      console.log('[DASHBOARD-STATS] User authenticated, setting initial delay', { userId: user.id })
      justAuthenticatedRef.current = true
      // Set a flag to delay the first query after login
      initialDelayRef.current = true
      // Reset after delay
      setTimeout(() => {
        console.log('[DASHBOARD-STATS] Initial delay expired, enabling query')
        initialDelayRef.current = false
      }, 2000) // 2 second delay after login to avoid rate limiting
    } else if (!isAuthenticated) {
      console.log('[DASHBOARD-STATS] User not authenticated, resetting flags')
      justAuthenticatedRef.current = false
      initialDelayRef.current = false
    }
  }, [isAuthenticated, user?.id])

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async () => {
      console.log('[DASHBOARD-STATS] Fetching dashboard stats')
      try {
        const data = await getDashboardStats()
        console.log('[DASHBOARD-STATS] Dashboard stats fetched successfully')
        return data
      } catch (err) {
        console.error('[DASHBOARD-STATS] Error fetching dashboard stats', err)
        throw err
      }
    },
    // Add delay after login to avoid rate limiting conflicts with other requests
    enabled: isAuthenticated && !!user?.id && !initialDelayRef.current,
    // Increased staleTime to reduce unnecessary refetches and prevent rate limiting
    staleTime: 5 * 60 * 1000, // 5 minutes (increased from 2 minutes)
    gcTime: 10 * 60 * 1000, // 10 minutes (increased from 5 minutes)
    // Use standardized retry logic that doesn't retry on 429 errors
    retry: createQueryRetry({ 
      maxRetries: 2, 
      maxRetriesRateLimit: 0, // Don't retry rate limit errors
      retryPaymentErrors: false 
    }),
    refetchOnWindowFocus: false,
    // Disable refetch on reconnect to prevent rate limit issues
    // Users can manually refresh if needed
    refetchOnReconnect: false,
  })

  const errorMessage = error
    ? getErrorMessage(error) || 'Failed to load dashboard data'
    : null

  return {
    data: data || null,
    loading: isLoading,
    error: errorMessage,
    refetch,
  }
}
