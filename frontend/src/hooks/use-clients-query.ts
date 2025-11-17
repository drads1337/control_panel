import { useQuery } from '@tanstack/react-query'
import { getClients, deleteUser } from '@/entities/user'
import type { User } from '@/entities/user'
import { useMutationWithCache } from './use-mutation-helpers'

// Cache keys
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: () => [...clientKeys.lists(), 'all'] as const,
}

interface UseClientsReturn {
  clients: User[]
  loading: boolean
  error: string | null
  
  // Actions
  deleteClient: (id: number) => Promise<void>
  
  // Data updates
  refetch: () => void
}

export function useClientsQuery(): UseClientsReturn {
  // Query для получения списка клиентов
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: clientKeys.list(),
    queryFn: async () => {
      const response = await getClients()
      return response.clients || []
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors (401, 403)
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      // Retry up to 2 times for other errors
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  // Мутация для удаления клиента с автоматической инвалидацией кэша
  const deleteClientMutation = useMutationWithCache({
    mutationFn: deleteUser,
    invalidateQueries: [clientKeys.lists()],
    successMessage: 'Client deleted successfully',
    errorMessage: 'Failed to delete client',
  })

  // Convert error to string for compatibility
  const errorMessage = error
    ? (error as any)?.response?.data?.error || 
      (error as any)?.response?.data?.message || 
      (error as any)?.message || 
      'Failed to load clients'
    : null

  return {
    clients: data || [],
    loading: isLoading,
    error: errorMessage,
    deleteClient: deleteClientMutation.mutateAsync,
    refetch,
  }
}
