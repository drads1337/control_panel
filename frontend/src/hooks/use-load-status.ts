import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'
import { enhancedApi as api } from '@/shared/api/enhanced-client'

export interface LoadStatusData {
  overall_status: 'normal' | 'warning' | 'critical'
  project_id: number | null
  endpoints: {
    connect: EndpointLoadStatus
    heartbeat: EndpointLoadStatus
  }
  timestamp: string
}

export interface EndpointLoadStatus {
  endpoint: string
  project_id?: number
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
  window_seconds?: number
}

export const loadStatusKeys = {
  all: ['load-status'] as const,
  status: () => [...loadStatusKeys.all, 'status'] as const,
}

export interface UseLoadStatusReturn {
  data: LoadStatusData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useLoadStatus(): UseLoadStatusReturn {
  const { isAuthenticated, user } = useAuthContext()

  console.log('[useLoadStatus] Hook called:', { isAuthenticated, userId: user?.id })

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: loadStatusKeys.status(),
    queryFn: async () => {
      console.log('[useLoadStatus] Fetching load status from /api/dashboard/load-status')
      try {
        const response = await api.get('/api/dashboard/load-status')
        console.log('[useLoadStatus] Response received:', response.data)
        return response.data.data as LoadStatusData
      } catch (err: any) {
        console.error('[useLoadStatus] Fetch error:', err)
        console.error('[useLoadStatus] Error details:', {
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          data: err?.response?.data,
          message: err?.message
        })
        throw err
      }
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 30 * 1000, // 30 seconds - load status updates frequently
    gcTime: 2 * 60 * 1000,
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    retry: (failureCount, error: any) => {
      console.log('[useLoadStatus] Retry attempt:', failureCount, error?.response?.status)
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  console.log('[useLoadStatus] Query state:', { isLoading, error, data: data ? 'has data' : 'no data' })

  const errorMessage = error
    ? (error as any)?.response?.data?.error || 
      (error as any)?.message || 
      'Failed to load load status'
    : null

  if (errorMessage) {
    console.error('[useLoadStatus] Error message:', errorMessage)
  }

  return {
    data: data || null,
    loading: isLoading,
    error: errorMessage,
    refetch,
  }
}

