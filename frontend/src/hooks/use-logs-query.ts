import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'
import { 
  getLogs, 
  getLogStats, 
  getConnectionLogs, 
  getConnectionLogStats, 
  searchLogs,
  exportLogs,
  cleanupLogs
} from '@/entities/log'
import type { Log, LogStats, ConnectionLog, ConnectionLogStats, LogsResponse } from '@/entities/log'

// Ключи для кэширования
export const logKeys = {
  all: ['logs'] as const,
  lists: () => [...logKeys.all, 'list'] as const,
  list: (params: any) => [...logKeys.lists(), params] as const,
  stats: () => [...logKeys.all, 'stats'] as const,
  search: (term: string, params: any) => [...logKeys.all, 'search', term, params] as const,
  connections: () => [...logKeys.all, 'connections'] as const,
  connectionList: (params: any) => [...logKeys.connections(), 'list', params] as const,
  connectionStats: () => [...logKeys.connections(), 'stats'] as const,
}

export interface LogFilters {
  action?: string | undefined
  userId?: number
  dateFrom?: string
  dateTo?: string
  ip?: string
  status?: string
  game?: string
  projectId?: number | string
}

export interface UseLogsOptions {
  page?: number
  perPage?: number
  filters?: LogFilters
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseLogsParams {
  page?: number
  per_page?: number
  filters?: LogFilters
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseLogsReturn {
  logs: Log[]
  loading: boolean
  error: string | null
  stats: LogStats | null
  pagination: {
    page: number
    perPage: number
    total: number
    pages: number
  }
  fetchLogs: (filters?: LogFilters) => void
  fetchStats: () => void
  searchLogsByTerm: (searchTerm: string) => void
  changePage: (page: number) => void
  changePerPage: (perPage: number) => void
  refresh: () => void
}

export function useLogsQuery(options: UseLogsOptions = {}): UseLogsReturn {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuthContext()
  
  const [pagination, setPagination] = React.useState({
    page: options.page || 1,
    perPage: options.perPage || 50,
  })
  
  const [filters, setFilters] = React.useState<LogFilters>(options.filters || {})
  const [searchTerm, setSearchTerm] = React.useState<string>('')
  const [isSearching, setIsSearching] = React.useState(false)

  // Query for logs
  const logsQuery = useQuery<LogsResponse, Error>({
    queryKey: logKeys.list({
      page: pagination.page,
      per_page: pagination.perPage,
      ...filters,
      isSearching,
      searchTerm: searchTerm || undefined
    }),
    queryFn: async () => {
      if (isSearching && searchTerm) {
        return await searchLogs(searchTerm, pagination.page, pagination.perPage)
      }
      return await getLogs(
        pagination.page,
        pagination.perPage,
        filters.action,
        filters.userId,
        filters.dateFrom,
        filters.dateTo,
        filters.ip,
        filters.projectId
      )
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: options.autoRefresh ? (options.refreshInterval || 30000) : false,
  })

  // Query for stats
  const statsQuery = useQuery<LogStats, Error>({
    queryKey: logKeys.stats(),
    queryFn: getLogStats,
    enabled: isAuthenticated,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: options.autoRefresh ? (options.refreshInterval || 30000) : false,
  })

  // Handlers
  const fetchLogs = React.useCallback((newFilters?: LogFilters) => {
    setIsSearching(false)
    setSearchTerm('')
    if (newFilters) {
      setFilters(newFilters)
      setPagination(prev => ({ ...prev, page: 1 }))
    }
  }, [])

  const fetchStats = React.useCallback(() => {
    statsQuery.refetch()
  }, [statsQuery])

  const searchLogsByTerm = React.useCallback((term: string) => {
    if (!term.trim()) {
      setIsSearching(false)
      setSearchTerm('')
      return
    }
    setIsSearching(true)
    setSearchTerm(term)
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [])

  const changePage = React.useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }, [])

  const changePerPage = React.useCallback((perPage: number) => {
    setPagination(prev => ({ ...prev, perPage, page: 1 }))
  }, [])

  const refresh = React.useCallback(() => {
    logsQuery.refetch()
    statsQuery.refetch()
  }, [logsQuery, statsQuery])

  return {
    logs: logsQuery.data?.logs || [],
    loading: logsQuery.isLoading || statsQuery.isLoading,
    error: logsQuery.error?.message || statsQuery.error?.message || null,
    stats: statsQuery.data || null,
    pagination: {
      page: logsQuery.data?.current_page || pagination.page,
      perPage: logsQuery.data?.per_page || pagination.perPage,
      total: logsQuery.data?.total || 0,
      pages: logsQuery.data?.pages || 0,
    },
    fetchLogs,
    fetchStats,
    searchLogsByTerm,
    changePage,
    changePerPage,
    refresh,
  }
}

interface UseConnectionLogsParams {
  page?: number
  per_page?: number
  filters?: {
    status?: string
    userId?: number
    dateFrom?: string
    dateTo?: string
    ip?: string
    game?: string
  }
}

interface UseConnectionLogsReturn {
  logs: ConnectionLog[]
  loading: boolean
  error: string | null
  stats: ConnectionLogStats | null
  pagination: {
    page: number
    perPage: number
    total: number
    pages: number
  }
  fetchConnectionLogs: (filters?: UseConnectionLogsParams['filters']) => void
  fetchConnectionStats: () => void
  changePage: (page: number) => void
  changePerPage: (perPage: number) => void
  refresh: () => void
}

export function useConnectionLogsQuery(options: UseConnectionLogsParams = {}): UseConnectionLogsReturn {
  const { isAuthenticated } = useAuthContext()
  
  const [pagination, setPagination] = React.useState({
    page: options.page || 1,
    perPage: options.per_page || 50,
  })
  
  const [filters, setFilters] = React.useState<UseConnectionLogsParams['filters']>(options.filters || {})

  // Query for connection logs
  const logsQuery = useQuery({
    queryKey: logKeys.connectionList({
      page: pagination.page,
      per_page: pagination.perPage,
      ...filters,
    }),
    queryFn: () => getConnectionLogs(
      pagination.page,
      pagination.perPage,
      filters?.status,
      filters?.userId,
      filters?.dateFrom,
      filters?.dateTo,
      filters?.ip,
      filters?.game
    ),
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
  })

  // Query for connection stats
  const statsQuery = useQuery({
    queryKey: logKeys.connectionStats(),
    queryFn: getConnectionLogStats,
    enabled: isAuthenticated,
    staleTime: 60 * 1000, // 1 minute
  })

  const fetchConnectionLogs = React.useCallback((newFilters?: UseConnectionLogsParams['filters']) => {
    if (newFilters) {
      setFilters(newFilters)
      setPagination(prev => ({ ...prev, page: 1 }))
    }
  }, [])

  const fetchConnectionStats = React.useCallback(() => {
    statsQuery.refetch()
  }, [statsQuery])

  const changePage = React.useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }, [])

  const changePerPage = React.useCallback((perPage: number) => {
    setPagination(prev => ({ ...prev, perPage, page: 1 }))
  }, [])

  const refresh = React.useCallback(() => {
    logsQuery.refetch()
    statsQuery.refetch()
  }, [logsQuery, statsQuery])

  return {
    logs: logsQuery.data?.logs || [],
    loading: logsQuery.isLoading || statsQuery.isLoading,
    error: logsQuery.error?.message || statsQuery.error?.message || null,
    stats: statsQuery.data || null,
    pagination: {
      page: logsQuery.data?.current_page || pagination.page,
      perPage: logsQuery.data?.per_page || pagination.perPage,
      total: logsQuery.data?.total || 0,
      pages: logsQuery.data?.pages || 0,
    },
    fetchConnectionLogs,
    fetchConnectionStats,
    changePage,
    changePerPage,
    refresh,
  }
}

export function useLogActions() {
  const exportLogsMutation = useMutation({
    mutationFn: async (filters: {
      action?: string
      userId?: number
      dateFrom?: string
      dateTo?: string
    }) => {
      const blob = await exportLogs(
        filters.action,
        filters.userId,
        filters.dateFrom,
        filters.dateTo
      )
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logs_export_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
  })

  const cleanupLogsMutation = useMutation({
    mutationFn: (daysOld: number = 90) => cleanupLogs(daysOld),
  })

  return {
    exportLogsToCSV: exportLogsMutation.mutateAsync,
    cleanupOldLogs: cleanupLogsMutation.mutateAsync,
    isExporting: exportLogsMutation.isPending,
    isCleaning: cleanupLogsMutation.isPending,
  }
}
