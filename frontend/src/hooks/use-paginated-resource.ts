import React from 'react'
import { useQuery, useQueryClient, UseQueryOptions, QueryKey } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'

export interface PaginatedData<T> {
  total: number
  pages: number
  current_page: number
  per_page: number
  [key: string]: any
}

export interface PaginationParams {
  page?: number
  per_page?: number
  [key: string]: any
}

export interface UsePaginatedResourceOptions<TData extends PaginatedData<TItem>, TItem, TParams extends PaginationParams = PaginationParams> {

  queryKeyFactory: {
    all: readonly unknown[]
    lists: () => readonly unknown[]
    list: (params: TParams) => readonly unknown[]
  }

  queryFn: (params: TParams) => Promise<TData>

  initialParams?: Partial<TParams>

  itemsField: string

  queryOptions?: Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn'>

  autoRefresh?: boolean
  refreshInterval?: number

  requireAuth?: boolean
}

export interface UsePaginatedResourceReturn<TItem, TParams extends PaginationParams = PaginationParams> {

  items: TItem[]

  loading: boolean

  error: string | null

  pagination: {
    total: number
    pages: number
    currentPage: number
    perPage: number
  }

  data: any

  setPage: (page: number) => void
  setPerPage: (perPage: number) => void
  setParams: (params: Partial<TParams> | ((prev: TParams) => TParams)) => void

  refetch: () => void

  clearError: () => void

  params: TParams
}

export function usePaginatedResource<TData extends PaginatedData<TItem>, TItem, TParams extends PaginationParams = PaginationParams>(
  options: UsePaginatedResourceOptions<TData, TItem, TParams>
): UsePaginatedResourceReturn<TItem, TParams> {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuthContext()

  const {
    queryKeyFactory,
    queryFn,
    itemsField,
    initialParams = {},
    queryOptions = {},
    autoRefresh = false,
    refreshInterval = 30000,
    requireAuth = true,
  } = options

  const [params, setParamsState] = React.useState<TParams>(() => ({
    page: 1,
    per_page: 20,
    ...initialParams,
  } as TParams))

  const setParams = React.useCallback((newParams: Partial<TParams> | ((prev: TParams) => TParams)) => {
    setParamsState((prev) => {
      if (typeof newParams === 'function') {
        return newParams(prev)
      }
      return { ...prev, ...newParams }
    })
  }, [])

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<TData, Error>({
    queryKey: queryKeyFactory.list(params),
    queryFn: () => queryFn(params),
    staleTime: 30 * 1000,
    enabled: requireAuth ? isAuthenticated : true,
    refetchInterval: autoRefresh ? refreshInterval : false,
    ...queryOptions,
  })

  const items = React.useMemo(() => {
    if (!data) return []
    const itemsArray = data[itemsField]
    return Array.isArray(itemsArray) ? itemsArray : []
  }, [data, itemsField])

  const pagination = React.useMemo(() => ({
    total: data?.total || 0,
    pages: data?.pages || 0,
    currentPage: data?.current_page || params.page || 1,
    perPage: data?.per_page || params.per_page || 20,
  }), [data, params])

  const setPage = React.useCallback((page: number) => {
    setParams((prev) => ({ ...prev, page } as TParams))
  }, [setParams])

  const setPerPage = React.useCallback((perPage: number) => {
    setParams((prev) => ({ ...prev, per_page: perPage, page: 1 } as TParams))
  }, [setParams])

  const clearError = React.useCallback(() => {
    queryClient.resetQueries({ queryKey: queryKeyFactory.lists() })
  }, [queryClient, queryKeyFactory])

  return {
    items,
    loading: isLoading,
    error: error?.message || null,
    pagination,
    data: data || null,
    setPage,
    setPerPage,
    setParams,
    refetch,
    clearError,
    params,
  }
}
