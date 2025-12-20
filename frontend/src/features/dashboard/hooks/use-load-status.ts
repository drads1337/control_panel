import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/app/providers/auth-provider'
import { enhancedApi as api } from '@/lib/api/enhanced-client'

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

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: loadStatusKeys.status(),
    queryFn: async () => {
      try {
        const response = await api.get('/api/dashboard/load-status')
        return response.data.data as LoadStatusData
      } catch (err: unknown) {
        throw err
      }
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 30 * 1000, // 30 seconds - load status updates frequently
    gcTime: 2 * 60 * 1000,
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const errorMessage = error
    ? (error as any)?.response?.data?.error || 
      (error as any)?.message || 
      'Failed to load load status'
    : null


  return {
    data: data || null,
    loading: isLoading,
    error: errorMessage,
    refetch,
  }
}

