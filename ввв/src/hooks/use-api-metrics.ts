import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getApiMetrics } from '@/entities/dashboard'
import { toast } from 'sonner'
import type { ApiMetrics } from '@/entities/dashboard'

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

      return await getApiMetrics()
    },
    staleTime: 0,
    gcTime: 1 * 60 * 1000,

    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }

      return failureCount < 2
    },
  })

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch API metrics'

      toast.error('Failed to load API metrics')
    }
  }, [error])

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
