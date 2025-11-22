import { useQuery } from '@tanstack/react-query'
import { getNavigationConfig, type NavigationConfig } from '@/entities/navigation'

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
    staleTime = 5 * 60 * 1000,
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
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
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

