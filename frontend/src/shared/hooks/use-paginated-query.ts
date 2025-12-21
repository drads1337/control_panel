import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/app/providers/auth-provider'

export interface BasePaginationParams {
  page?: number
  per_page?: number
}

export interface UsePaginatedQueryOptions<TParams extends BasePaginationParams, TData> {
  queryKey: readonly unknown[]
  queryFn: (params: TParams) => Promise<TData>
  initialParams?: TParams
  staleTime?: number
  enabled?: boolean
  refetchInterval?: number | false
  requireAuth?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  pages: number
  current_page: number
  per_page: number
}

export interface UsePaginatedQueryReturn<TData, TParams extends BasePaginationParams> {
  data: TData | undefined
  loading: boolean
  error: string | null
  pagination: {
    total: number
    pages: number
    currentPage: number
    perPage: number
  }
  params: TParams
  setParams: (params: Partial<TParams> | ((prev: TParams) => TParams)) => void
  setPage: (page: number) => void
  setPerPage: (perPage: number) => void
  refetch: () => void
}

export function usePaginatedQuery<
  TParams extends BasePaginationParams,
  TData extends PaginatedResponse<TItem>,
  TItem = unknown
>(options: UsePaginatedQueryOptions<TParams, TData>): UsePaginatedQueryReturn<TData, TParams> {
  const { isAuthenticated } = useAuthContext()
  const {
    queryKey,
    queryFn,
    initialParams,
    staleTime = 2 * 60 * 1000,
    enabled = true,
    refetchInterval = false,
    requireAuth = true,
  } = options

  const [params, setParams] = React.useState<TParams>(() => ({
    page: 1,
    per_page: 20,
    ...initialParams,
  } as TParams))

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKey, params],
    queryFn: () => queryFn(params),
    staleTime,
    enabled: requireAuth ? (isAuthenticated && enabled) : enabled,
    refetchInterval,
  })

  const handleSetParams = React.useCallback((newParams: Partial<TParams> | ((prev: TParams) => TParams)) => {
    setParams(prev => {
      if (typeof newParams === 'function') {
        return newParams(prev)
      }
      return { ...prev, ...newParams }
    })
  }, [])

  const handleSetPage = React.useCallback((page: number) => {
    setParams(prev => ({ ...prev, page }))
  }, [])

  const handleSetPerPage = React.useCallback((perPage: number) => {
    setParams(prev => ({ ...prev, per_page: perPage, page: 1 }))
  }, [])

  const pagination = React.useMemo(() => {
    if (data && 'total' in data && 'pages' in data && 'current_page' in data && 'per_page' in data) {
      return {
        total: data.total,
        pages: data.pages,
        currentPage: data.current_page,
        perPage: data.per_page,
      }
    }
    return {
      total: 0,
      pages: 0,
      currentPage: params.page || 1,
      perPage: params.per_page || 20,
    }
  }, [data, params])

  return {
    data: data as TData | undefined,
    loading: isLoading,
    error: error?.message || null,
    pagination,
    params,
    setParams: handleSetParams,
    setPage: handleSetPage,
    setPerPage: handleSetPerPage,
    refetch,
  }
}
