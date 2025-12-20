import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  getSessions, 
  getSessionStats, 
  terminateSession, 
  bulkTerminateSessions, 
  getRealtimeSessions 
} from '@/entities/session'
import type { Session, SessionStats, SessionsResponse } from '@/entities/session'
import { usePaginatedResource } from '@/hooks/use-paginated-resource'
import { useMutationWithCache } from '@/hooks/use-mutation-helpers'

export const sessionKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionKeys.all, 'list'] as const,
  list: (params: any) => [...sessionKeys.lists(), params] as const,
  stats: () => [...sessionKeys.all, 'stats'] as const,
  realtime: () => [...sessionKeys.all, 'realtime'] as const,
}

interface UseSessionsParams {
  page?: number
  per_page?: number
  userId?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseSessionsReturn {
  sessions: Session[]
  stats: SessionStats | null
  loading: boolean
  error: string | null
  pagination: {
    total: number
    pages: number
    currentPage: number
    perPage: number
  }

  terminateUserSession: (userId: number) => Promise<{ success: boolean; error?: string }>
  terminateMultipleSessions: (userIds: number[]) => Promise<{ success: boolean; error?: string }>

  changePage: (page: number) => void
  changePerPage: (perPage: number) => void

  refresh: () => void
  clearError: () => void
}

export function useSessionsQuery(options: UseSessionsParams = {}): UseSessionsReturn {
  const {
    page = 1,
    per_page = 20,
    userId,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options

  const {
    items: sessions,
    loading: sessionsLoading,
    error,
    pagination,
    data: sessionsData,
    setPage,
    setPerPage,
    refetch: refetchSessions,
    clearError,
  } = usePaginatedResource<SessionsResponse, Session, UseSessionsParams>({
    queryKeyFactory: sessionKeys,
    queryFn: (params) => getSessions(params.page || 1, params.per_page || 20, params.userId),
    itemsField: 'sessions',
    initialParams: { page, per_page, userId },
    queryOptions: {
      staleTime: 30 * 1000,
    },
    autoRefresh,
    refreshInterval,
  })

  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: sessionKeys.stats(),
    queryFn: getSessionStats,
    staleTime: 15 * 1000,
    enabled: true,
    refetchInterval: autoRefresh ? Math.min(refreshInterval, 15 * 1000) : false,
  })

  const {
    data: realtimeData,
  } = useQuery({
    queryKey: sessionKeys.realtime(),
    queryFn: getRealtimeSessions,
    staleTime: 0,
    enabled: autoRefresh,
    refetchInterval: autoRefresh ? Math.min(refreshInterval, 10 * 1000) : false,
  })

  const activeSessions = React.useMemo(() => {
    if (autoRefresh && realtimeData?.sessions) {
      return realtimeData.sessions
    }
    return sessions
  }, [autoRefresh, realtimeData, sessions])

  const activePagination = React.useMemo(() => {
    if (autoRefresh && realtimeData) {
      return {
        total: realtimeData.count,
        pages: 1,
        currentPage: 1,
        perPage: realtimeData.count,
      }
    }
    return pagination
  }, [autoRefresh, realtimeData, pagination])

  const terminateSessionMutation = useMutationWithCache({
    mutationFn: (userId: number) => terminateSession(userId),
    invalidateQueries: [sessionKeys.lists(), sessionKeys.stats()],
    successMessage: 'Session terminated successfully',
    errorMessage: 'Failed to terminate session',
  })

  const bulkTerminateSessionsMutation = useMutationWithCache({
    mutationFn: (userIds: number[]) => bulkTerminateSessions(userIds),
    invalidateQueries: [sessionKeys.lists(), sessionKeys.stats()],
    successMessage: 'Sessions terminated successfully',
    errorMessage: 'Failed to terminate sessions',
  })

  const terminateUserSession = React.useCallback(async (userId: number) => {
    try {
      await terminateSessionMutation.mutateAsync(userId)
      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to terminate session'
      return { success: false, error: errorMessage }
    }
  }, [terminateSessionMutation])

  const terminateMultipleSessions = React.useCallback(async (userIds: number[]) => {
    try {
      await bulkTerminateSessionsMutation.mutateAsync(userIds)
      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to terminate sessions'
      return { success: false, error: errorMessage }
    }
  }, [bulkTerminateSessionsMutation])

  const changePage = React.useCallback((newPage: number) => {
    setPage(newPage)
  }, [setPage])

  const changePerPage = React.useCallback((newPerPage: number) => {
    setPerPage(newPerPage)
  }, [setPerPage])

  const refresh = React.useCallback(async () => {
    await Promise.all([refetchSessions(), refetchStats()])
  }, [refetchSessions, refetchStats])

  return {
    sessions: activeSessions,
    stats: statsData || null,
    loading: sessionsLoading || statsLoading,
    error,
    pagination: activePagination,
    terminateUserSession,
    terminateMultipleSessions,
    changePage,
    changePerPage,
    refresh,
    clearError,
  }
}

