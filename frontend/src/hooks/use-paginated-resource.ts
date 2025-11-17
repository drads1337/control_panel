import React from 'react'
import { useQuery, useQueryClient, UseQueryOptions, QueryKey } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'

/**
 * Универсальный интерфейс для пагинированного ответа API
 */
export interface PaginatedData<T> {
  total: number
  pages: number
  current_page: number
  per_page: number
  [key: string]: any // Для специфичных полей вроде projects[], users[], sessions[]
}

/**
 * Базовые параметры пагинации
 */
export interface PaginationParams {
  page?: number
  per_page?: number
  [key: string]: any // Для дополнительных параметров (search, filters и т.д.)
}

/**
 * Опции для usePaginatedResource
 */
export interface UsePaginatedResourceOptions<TData extends PaginatedData<TItem>, TItem, TParams extends PaginationParams = PaginationParams> {
  /** Factory для создания query keys */
  queryKeyFactory: {
    all: readonly unknown[]
    lists: () => readonly unknown[]
    list: (params: TParams) => readonly unknown[]
  }
  
  /** Функция для получения данных */
  queryFn: (params: TParams) => Promise<TData>
  
  /** Начальные параметры запроса */
  initialParams?: Partial<TParams>
  
  /** Имя поля в ответе, содержащего массив элементов (например, 'projects', 'users', 'sessions') */
  itemsField: string
  
  /** Опции react-query */
  queryOptions?: Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn'>
  
  /** Автоматическое обновление данных */
  autoRefresh?: boolean
  refreshInterval?: number
  
  /** Включить запрос только если пользователь аутентифицирован */
  requireAuth?: boolean
}

/**
 * Возвращаемый тип хука
 */
export interface UsePaginatedResourceReturn<TItem, TParams extends PaginationParams = PaginationParams> {
  /** Массив элементов */
  items: TItem[]
  
  /** Состояние загрузки */
  loading: boolean
  
  /** Сообщение об ошибке */
  error: string | null
  
  /** Пагинационная информация */
  pagination: {
    total: number
    pages: number
    currentPage: number
    perPage: number
  }
  
  /** Полные данные ответа */
  data: any
  
  /** Методы пагинации */
  setPage: (page: number) => void
  setPerPage: (perPage: number) => void
  setParams: (params: Partial<TParams> | ((prev: TParams) => TParams)) => void
  
  /** Обновление данных */
  refetch: () => void
  
  /** Очистка ошибки */
  clearError: () => void
  
  /** Текущие параметры запроса */
  params: TParams
}

/**
 * Универсальный хук для работы с пагинированными ресурсами
 * 
 * @example
 * ```ts
 * const { items, loading, error, pagination, setPage, setPerPage } = usePaginatedResource({
 *   queryKeyFactory: projectKeys,
 *   queryFn: (params) => getProjects(params.page, params.per_page, params.search),
 *   itemsField: 'projects',
 *   initialParams: { page: 1, per_page: 20 },
 * })
 * ```
 */
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

  // Параметры запроса
  const [params, setParamsState] = React.useState<TParams>(() => ({
    page: 1,
    per_page: 20,
    ...initialParams,
  } as TParams))

  // Обновление параметров
  const setParams = React.useCallback((newParams: Partial<TParams> | ((prev: TParams) => TParams)) => {
    setParamsState((prev) => {
      if (typeof newParams === 'function') {
        return newParams(prev)
      }
      return { ...prev, ...newParams }
    })
  }, [])

  // Основной запрос данных
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<TData, Error>({
    queryKey: queryKeyFactory.list(params),
    queryFn: () => queryFn(params),
    staleTime: 30 * 1000, // 30 секунд по умолчанию
    enabled: requireAuth ? isAuthenticated : true,
    refetchInterval: autoRefresh ? refreshInterval : false,
    ...queryOptions,
  })

  // Извлечение элементов из ответа
  const items = React.useMemo(() => {
    if (!data) return []
    const itemsArray = data[itemsField]
    return Array.isArray(itemsArray) ? itemsArray : []
  }, [data, itemsField])

  // Пагинационная информация
  const pagination = React.useMemo(() => ({
    total: data?.total || 0,
    pages: data?.pages || 0,
    currentPage: data?.current_page || params.page || 1,
    perPage: data?.per_page || params.per_page || 20,
  }), [data, params])

  // Методы пагинации
  const setPage = React.useCallback((page: number) => {
    setParams((prev) => ({ ...prev, page } as TParams))
  }, [setParams])

  const setPerPage = React.useCallback((perPage: number) => {
    setParams((prev) => ({ ...prev, per_page: perPage, page: 1 } as TParams))
  }, [setParams])

  // Очистка ошибки
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

