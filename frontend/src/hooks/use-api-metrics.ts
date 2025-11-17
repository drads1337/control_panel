import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getApiMetrics } from '@/entities/dashboard'
import { toast } from 'sonner'
import type { ApiMetrics } from '@/entities/dashboard'

// Cache keys
export const apiMetricsKeys = {
  all: ['api-metrics'] as const,
  detail: () => [...apiMetricsKeys.all, 'metrics'] as const,
}

export function useApiMetrics() {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: apiMetricsKeys.detail(),
    queryFn: async () => {
      // With httpOnly cookies, authentication is handled automatically
      // No need to check for localStorage tokens
      return await getApiMetrics()
    },
    staleTime: 0, // Always refetch (data changes frequently)
    gcTime: 1 * 60 * 1000, // 1 minute
    // Auto-refresh every 30 seconds
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors (401, 403)
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      // Retry up to 2 times for other errors
      return failureCount < 2
    },
  })

  // Handle errors via effect instead of onError callback
  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch API metrics'
      console.error('Failed to fetch API metrics:', error)
      toast.error('Failed to load API metrics')
    }
  }, [error])

  // Convert error to string for compatibility
  const errorMessage = error
    ? (error as any)?.response?.data?.error || 
      (error as any)?.response?.data?.message || 
      (error instanceof Error ? error.message : 'Failed to fetch API metrics')
    : null

  return {
    data: data || null,
    isLoading,
    error: errorMessage,
    refetch,
  }
}
