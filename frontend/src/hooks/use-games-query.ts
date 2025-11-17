import { useQuery } from '@tanstack/react-query'
import { getGames, getGamesAvailableForAssignment } from '@/entities/game'
import type { Game } from '@/entities/game'

// Cache keys for games
export const gameKeys = {
  all: ['games'] as const,
  lists: () => [...gameKeys.all, 'list'] as const,
  list: (type?: string) => [...gameKeys.lists(), type] as const,
  details: () => [...gameKeys.all, 'detail'] as const,
  detail: (id: number) => [...gameKeys.details(), id] as const,
  availableForAssignment: () => [...gameKeys.all, 'available-for-assignment'] as const,
}

interface UseGamesQueryReturn {
  games: Game[]
  loading: boolean
  error: string | null
  refetch: () => void
}

interface UseGamesAvailableForAssignmentReturn {
  games: Game[]
  totalCount: number
  page: number
  perPage: number
  totalPages: number
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook for fetching all games with optional type filter
 */
export function useGamesQuery(type: string = 'all'): UseGamesQueryReturn {
  const {
    data: gamesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: gameKeys.list(type),
    queryFn: async () => {
      const response = await getGames(type)
      return response
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      // Don't retry on payment required
      if (error?.response?.status === 402) {
        return false
      }
      // Don't retry on rate limit errors
      if (error?.response?.status === 429) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  // Convert error to string
  const errorMessage = error
    ? (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'Failed to load games'
    : null

  return {
    games: gamesData?.games || [],
    loading: isLoading,
    error: errorMessage,
    refetch,
  }
}

/**
 * Hook for fetching games available for assignment (paginated)
 */
export function useGamesAvailableForAssignment(
  page: number = 1,
  perPage: number = 50
): UseGamesAvailableForAssignmentReturn {
  const {
    data: gamesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...gameKeys.availableForAssignment(), page, perPage],
    queryFn: async () => {
      const response = await getGamesAvailableForAssignment(page, perPage)
      return response
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      if (error?.response?.status === 402) {
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

  // Convert error to string
  const errorMessage = error
    ? (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'Failed to load available games'
    : null

  return {
    games: gamesData?.games || [],
    totalCount: gamesData?.total_count || 0,
    page: gamesData?.page || page,
    perPage: gamesData?.per_page || perPage,
    totalPages: gamesData?.total_pages || 0,
    loading: isLoading,
    error: errorMessage,
    refetch,
  }
}

