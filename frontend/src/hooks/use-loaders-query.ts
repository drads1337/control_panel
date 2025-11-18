import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getLoaders,
  getAvailableGames,
  getLoaderStats,
  createLoader,
  updateLoader,
  deleteLoader,
  updateLoaderStatus,
  assignGamesToLoader,
  unassignGamesFromLoader,
} from '@/entities/loader'
import type {
  Loader,
  LoaderStats,
  CreateLoaderData,
  UpdateLoaderData,
} from '@/entities/loader'
import type { Game } from '@/entities/game'
import { useMutationWithCache } from './use-mutation-helpers'

export const loaderKeys = {
  all: ['loaders'] as const,
  lists: () => [...loaderKeys.all, 'list'] as const,
  list: () => [...loaderKeys.lists()] as const,
  details: () => [...loaderKeys.all, 'detail'] as const,
  detail: (id: number) => [...loaderKeys.details(), id] as const,
  stats: () => [...loaderKeys.all, 'stats'] as const,
  availableGames: () => [...loaderKeys.all, 'available-games'] as const,
}

interface UseLoadersQueryReturn {
  loaders: Loader[]
  loading: boolean
  error: string | null
  stats: LoaderStats | null
  statsLoading: boolean
  games: Game[]
  gamesLoading: boolean
  gamesError: string | null

  createLoader: (data: CreateLoaderData) => Promise<{ loader: any; success: boolean; message: string }>
  updateLoader: (id: number, data: UpdateLoaderData) => Promise<{ success: boolean; message: string }>
  deleteLoader: (id: number) => Promise<{ success: boolean; message: string }>
  updateStatus: (id: number, status: 'active' | 'inactive' | 'maintenance' | 'testing') => Promise<{ success: boolean; message: string }>
  assignGames: (loaderId: number, gameIds: number[]) => Promise<{ success: boolean; message: string }>
  unassignGames: (loaderId: number, gameIds: number[]) => Promise<{ success: boolean; message: string }>

  refetch: () => void
  refetchStats: () => void
  refetchGames: () => void
}

export function useLoadersQuery(): UseLoadersQueryReturn {
  const queryClient = useQueryClient()

  const {
    data: loadersData,
    isLoading: loadersLoading,
    error: loadersError,
    refetch: refetchLoaders,
  } = useQuery({
    queryKey: loaderKeys.list(),
    queryFn: async () => {
      const response = await getLoaders()
      return response
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {

      if (error?.response?.status === 401 || error?.response?.status === 403) {
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

  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: loaderKeys.stats(),
    queryFn: async () => {
      const response = await getLoaderStats()

      return response.stats || null
    },
    staleTime: 1 * 60 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      if (error?.response?.status === 429) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
  })

  const {
    data: gamesData,
    isLoading: gamesLoading,
    error: gamesError,
    refetch: refetchGames,
  } = useQuery({
    queryKey: loaderKeys.availableGames(),
    queryFn: async () => {
      const response = await getAvailableGames()
      return response
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
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

  const createLoaderMutation = useMutationWithCache({
    mutationFn: createLoader,
    invalidateQueries: [loaderKeys.list(), loaderKeys.stats()],
    successMessage: 'Loader created successfully',
    errorMessage: 'Failed to create loader',
  })

  const updateLoaderMutation = useMutationWithCache({
    mutationFn: ({ id, data }: { id: number; data: UpdateLoaderData }) =>
      updateLoader(id, data),
    invalidateQueries: [loaderKeys.list(), loaderKeys.stats(), loaderKeys.details()],
    successMessage: 'Loader updated successfully',
    errorMessage: 'Failed to update loader',
  })

  const deleteLoaderMutation = useMutationWithCache({
    mutationFn: deleteLoader,
    invalidateQueries: [loaderKeys.list(), loaderKeys.stats()],
    successMessage: 'Loader deleted successfully',
    errorMessage: 'Failed to delete loader',
  })

  const updateStatusMutation = useMutationWithCache({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) =>
      updateLoaderStatus(id, status),
    invalidateQueries: [loaderKeys.list(), loaderKeys.stats(), loaderKeys.details()],
    successMessage: 'Loader status updated successfully',
    errorMessage: 'Failed to update loader status',
  })

  const assignGamesMutation = useMutationWithCache({
    mutationFn: ({ loaderId, gameIds }: { loaderId: number; gameIds: number[] }) =>
      assignGamesToLoader(loaderId, gameIds),
    invalidateQueries: [loaderKeys.list(), loaderKeys.details()],
    successMessage: 'Games assigned successfully',
    errorMessage: 'Failed to assign games',
  })

  const unassignGamesMutation = useMutationWithCache({
    mutationFn: ({ loaderId, gameIds }: { loaderId: number; gameIds: number[] }) =>
      unassignGamesFromLoader(loaderId, gameIds),
    invalidateQueries: [loaderKeys.list(), loaderKeys.details()],
    successMessage: 'Games unassigned successfully',
    errorMessage: 'Failed to unassign games',
  })

  const errorMessage = loadersError
    ? (loadersError as any)?.response?.data?.message ||
      (loadersError as any)?.message ||
      'Failed to load loaders'
    : null

  const gamesErrorMessage = gamesError
    ? (gamesError as any)?.response?.data?.message ||
      (gamesError as any)?.message ||
      'Failed to load games'
    : null

  return {
    loaders: loadersData?.loaders || [],
    loading: loadersLoading,
    error: errorMessage,
    stats: statsData || null,
    statsLoading,
    games: gamesData?.games || [],
    gamesLoading,
    gamesError: gamesErrorMessage,

    createLoader: createLoaderMutation.mutateAsync,
    updateLoader: (id: number, data: UpdateLoaderData) =>
      updateLoaderMutation.mutateAsync({ id, data }),
    deleteLoader: deleteLoaderMutation.mutateAsync,
    updateStatus: (id: number, status: 'active' | 'inactive' | 'maintenance' | 'testing') =>
      updateStatusMutation.mutateAsync({ id, status }),
    assignGames: (loaderId: number, gameIds: number[]) =>
      assignGamesMutation.mutateAsync({ loaderId, gameIds }),
    unassignGames: (loaderId: number, gameIds: number[]) =>
      unassignGamesMutation.mutateAsync({ loaderId, gameIds }),

    refetch: () => {
      refetchLoaders()
      refetchStats()
    },
    refetchStats,
    refetchGames,
  }
}
