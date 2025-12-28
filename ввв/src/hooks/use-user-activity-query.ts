import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUserActivity, getUserActivityStats } from '@/entities/user'
import type { UserActivity, UserActivityStats } from '@/entities/user'
import { useAuthContext } from '@/contexts/auth-context'

export const userActivityKeys = {
  all: ['user-activity'] as const,
  list: (page: number, perPage: number) => [...userActivityKeys.all, 'list', page, perPage] as const,
  stats: () => [...userActivityKeys.all, 'stats'] as const,
}

export interface UseUserActivityQueryOptions {
  page?: number
  perPage?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export interface UseUserActivityQueryReturn {
  activities: UserActivity[]
  stats: UserActivityStats | null
  loading: boolean
  statsLoading: boolean
  error: string | null
  pagination: {
    total: number
    pages: number
    currentPage: number
    perPage: number
  }

  changePage: (page: number) => void
  changePerPage: (perPage: number) => void
  refetch: () => void
  refetchStats: () => void
}

export function useUserActivityQuery(
  options: UseUserActivityQueryOptions = {}
): UseUserActivityQueryReturn {
  const { isAuthenticated } = useAuthContext()
  const {
    page = 1,
    perPage = 20,
    autoRefresh = false,
    refreshInterval = 60000,
  } = options

  const [paginationState, setPaginationState] = React.useState({
    currentPage: page,
    perPage,
  })

  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    error: activitiesError,
    refetch: refetchActivities,
  } = useQuery({
    queryKey: userActivityKeys.list(paginationState.currentPage, paginationState.perPage),
    queryFn: async () => {
      return await getUserActivity(paginationState.currentPage, paginationState.perPage)
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: autoRefresh,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
  })

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: userActivityKeys.stats(),
    queryFn: async () => {
      return await getUserActivityStats('')
    },
    enabled: isAuthenticated,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: autoRefresh,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
  })

  const changePage = React.useCallback((newPage: number) => {
    setPaginationState(prev => ({ ...prev, currentPage: newPage }))
  }, [])

  const changePerPage = React.useCallback((newPerPage: number) => {
    setPaginationState(prev => ({ ...prev, perPage: newPerPage, currentPage: 1 }))
  }, [])

  const refetch = React.useCallback(() => {
    refetchActivities()
    refetchStats()
  }, [refetchActivities, refetchStats])

  return {
    activities: activitiesData?.activities || [],
    stats: stats || null,
    loading: activitiesLoading,
    statsLoading,
    error: activitiesError?.message || null,
    pagination: {
      total: activitiesData?.total || 0,
      pages: activitiesData?.pages || 0,
      currentPage: activitiesData?.current_page || paginationState.currentPage,
      perPage: activitiesData?.per_page || paginationState.perPage,
    },
    changePage,
    changePerPage,
    refetch,
    refetchStats,
  }
}
