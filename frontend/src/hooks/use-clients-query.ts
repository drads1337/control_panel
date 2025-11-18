import { useQuery } from '@tanstack/react-query'
import { getClients, deleteUser } from '@/entities/user'
import type { User } from '@/entities/user'
import { useMutationWithCache } from './use-mutation-helpers'

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: () => [...clientKeys.lists(), 'all'] as const,
}

interface UseClientsReturn {
  clients: User[]
  loading: boolean
  error: string | null

  deleteClient: (id: number) => Promise<void>

  refetch: () => void
}

export function useClientsQuery(): UseClientsReturn {

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
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }

      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  const deleteClientMutation = useMutationWithCache({
    mutationFn: deleteUser,
    invalidateQueries: [clientKeys.lists()],
    successMessage: 'Client deleted successfully',
    errorMessage: 'Failed to delete client',
  })

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
