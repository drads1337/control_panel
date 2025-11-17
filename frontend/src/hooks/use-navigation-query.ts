import { useQuery } from '@tanstack/react-query'
import { getNavigationConfig, type NavigationConfig } from '@/entities/navigation'

// Cache keys for navigation
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

/**
 * React Query hook for fetching navigation configuration
 * 
 * This hook replaces static navigation logic with a dynamic, server-driven approach.
 * The navigation configuration is cached and automatically refetched when needed.
 * 
 * @param options - Query options
 * @returns Navigation configuration and query state
 */
export function useNavigationQuery(options: UseNavigationQueryOptions = {}): UseNavigationQueryReturn {
  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes - navigation config doesn't change often
  } = options

  const {
    data: navigation,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: navigationKeys.config(),
    queryFn: () => getNavigationConfig(),
    enabled,
    staleTime,
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    // Silently fail - navigation will fallback to empty array
    meta: {
      errorMessage: null,
    },
  })

  return {
    navigation,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}

