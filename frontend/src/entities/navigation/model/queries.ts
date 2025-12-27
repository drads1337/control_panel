import { useQuery } from '@tanstack/react-query'
import { getNavigationConfig, type NavigationConfig } from '@/entities/navigation'
import { createQueryRetry } from '@/shared/lib/query-retry-utils'

export const navigationKeys = {
  all: ['navigation'] as const,
  config: () => [...navigationKeys.all, 'config'] as const,
}

interface UseNavigationQueryOptions {
  enabled?: boolean
  staleTime?: number
}

interface UseNavigationQueryReturn {
  navigation: NavigationConfig | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

export function useNavigationQuery(options: UseNavigationQueryOptions = {}): UseNavigationQueryReturn {
  const {
    enabled = true,
    staleTime = 15 * 60 * 1000, // Default to 15 minutes (matches query defaults)
  } = options

  const {
    data: navigation,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: navigationKeys.config(),
    queryFn: async () => {
      console.log('[NAVIGATION] Fetching navigation config', { enabled })
      try {
        const config = await getNavigationConfig()
        console.log('[NAVIGATION] Navigation config fetched', { 
          itemsCount: config?.navigation?.length || 0 
        })
        return config
      } catch (err) {
        console.error('[NAVIGATION] Error fetching navigation config', err)
        throw err
      }
    },
    enabled,
    staleTime,
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnWindowFocus: false, // Navigation doesn't need to refetch on focus
    refetchOnReconnect: false, // Navigation doesn't need to refetch on reconnect
    // Use standardized retry logic that doesn't retry on 429 errors
    retry: createQueryRetry({ 
      maxRetries: 2, 
      maxRetriesRateLimit: 0, // Don't retry rate limit errors
      retryPaymentErrors: false 
    }),
    meta: {
      errorMessage: null,
    },
  })

  // Log navigation query state changes
  if (isError && error) {
    console.error('[NAVIGATION] Navigation query error', {
      errorMessage: error.message,
      status: (error as any)?.response?.status
    })
  }

  return {
    navigation,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}

