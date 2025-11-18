import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getLicenseKeys, 
  createLicenseKey,
  createCustomLicenseKey,
  bulkCreateLicenseKeys,
  getKeysStats,
  type LicenseKeysResponse,
  type CreateKeyData,
  type BulkCreateKeysData,
  type KeysStats
} from '@/entities/key'
import { toast } from 'sonner'
import { useAuthContext } from '@/contexts/auth-context'
import { measurePerformance } from '@/lib/sentry-config'

export const keyKeys = {
  all: ['keys'] as const,
  lists: () => [...keyKeys.all, 'list'] as const,
  list: (params: any) => [...keyKeys.lists(), params] as const,
  stats: () => [...keyKeys.all, 'stats'] as const,
}

interface UseKeysParams {
  page?: number
  per_page?: number
  status?: string
  game_id?: number
  search?: string
  my_keys?: boolean
}

interface UseKeysReturn {
  keys: any[]
  loading: boolean
  error: string | null
  total: number
  pages: number
  currentPage: number
  perPage: number

  createKey: (data: CreateKeyData) => Promise<any>
  createCustomKey: (data: CreateKeyData & { custom_key: string }) => Promise<any>
  bulkCreateKeys: (data: BulkCreateKeysData) => Promise<any>

  setPage: (page: number) => void
  setPerPage: (perPage: number) => void
  setStatus: (status: string) => void
  setGameId: (gameId: number | undefined) => void
  setSearch: (search: string) => void
  setMyKeys: (myKeys: boolean) => void

  refetch: () => void
}

export function useKeysQuery(initialParams: UseKeysParams = {}): UseKeysReturn {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuthContext()

  const [params, setParams] = React.useState<UseKeysParams>({
    page: 1,
    per_page: 20,
    ...initialParams,
  })

  React.useEffect(() => {
    setParams(prev => {

      const updated: UseKeysParams = { ...prev }
      if (initialParams.page !== undefined) updated.page = initialParams.page
      if (initialParams.per_page !== undefined) updated.per_page = initialParams.per_page
      if (initialParams.status !== undefined) updated.status = initialParams.status
      if (initialParams.game_id !== undefined) updated.game_id = initialParams.game_id
      if (initialParams.search !== undefined) updated.search = initialParams.search
      if (initialParams.my_keys !== undefined) updated.my_keys = initialParams.my_keys

      const hasChanges = 
        updated.page !== prev.page ||
        updated.per_page !== prev.per_page ||
        updated.status !== prev.status ||
        updated.game_id !== prev.game_id ||
        updated.search !== prev.search ||
        updated.my_keys !== prev.my_keys

      return hasChanges ? updated : prev
    })
  }, [initialParams.page, initialParams.per_page, initialParams.status, initialParams.game_id, initialParams.search, initialParams.my_keys])

  const {
    data: keysData,
    isLoading: keysLoading,
    error: keysError,
    refetch: refetchKeys,
  } = useQuery({
    queryKey: keyKeys.list(params),
    queryFn: async () => {
      return measurePerformance(
        'keys_table_load',
        () => getLicenseKeys(
          params.page || 1,
          params.per_page || 20,
          params.status,
          params.game_id,
          params.search,
          params.my_keys
        ),
        {
          page: params.page || 1,
          per_page: params.per_page || 20,
          status: params.status || 'all',
          has_game_filter: !!params.game_id,
          has_search: !!params.search,
          my_keys: params.my_keys || false,
        }
      )
    },
    staleTime: 2 * 60 * 1000,
    enabled: isAuthenticated,
  })

  const createKeyMutation = useMutation({
    mutationFn: (data: CreateKeyData) => createLicenseKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: keyKeys.stats() })
      toast.success('License key created successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create license key')
    },
  })

  const createCustomKeyMutation = useMutation({
    mutationFn: (data: CreateKeyData & { custom_key: string }) => createCustomLicenseKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: keyKeys.stats() })
      toast.success('Custom license key created successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create custom license key')
    },
  })

  const bulkCreateKeysMutation = useMutation({
    mutationFn: (data: BulkCreateKeysData) => bulkCreateLicenseKeys(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: keyKeys.stats() })
      toast.success('License keys created successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create license keys')
    },
  })

  const setPage = (page: number) => {
    setParams(prev => ({ ...prev, page }))
  }

  const setPerPage = (perPage: number) => {
    setParams(prev => ({ ...prev, per_page: perPage, page: 1 }))
  }

  const setStatus = (status: string) => {
    setParams(prev => ({ ...prev, status: status === 'all' ? undefined : status, page: 1 }))
  }

  const setGameId = (gameId: number | undefined) => {
    setParams(prev => ({ ...prev, game_id: gameId, page: 1 }))
  }

  const setSearch = (search: string) => {
    setParams(prev => ({ ...prev, search: search || undefined, page: 1 }))
  }

  const setMyKeys = (myKeys: boolean) => {
    setParams(prev => ({ ...prev, my_keys: myKeys, page: 1 }))
  }

  return {
    keys: keysData?.keys || [],
    loading: keysLoading,
    error: keysError?.message || null,
    total: keysData?.total || 0,
    pages: keysData?.pages || 0,
    currentPage: keysData?.current_page || 1,
    perPage: keysData?.per_page || 20,

    createKey: createKeyMutation.mutateAsync,
    createCustomKey: createCustomKeyMutation.mutateAsync,
    bulkCreateKeys: bulkCreateKeysMutation.mutateAsync,

    setPage,
    setPerPage,
    setStatus,
    setGameId,
    setSearch,
    setMyKeys,

    refetch: refetchKeys,
  }
}

export function useKeysStats() {
  const { isAuthenticated } = useAuthContext()

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: keyKeys.stats(),
    queryFn: getKeysStats,
    staleTime: 2 * 60 * 1000,
    enabled: isAuthenticated,
  })

  return {
    stats: stats || null,
    loading: isLoading,
    error: error?.message || null,
    refetch,
  }
}
