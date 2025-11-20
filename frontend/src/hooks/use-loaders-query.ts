import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getLoaders,  // Backward compatibility - uses getAgents internally
  getAgents,  // New universal function
  getAvailableGames,  // Backward compatibility
  getAvailableProducts,  // New universal function
  getLoaderStats,  // Backward compatibility
  getAgentStats,  // New universal function
  createLoader,  // Backward compatibility
  createAgent,  // New universal function
  updateLoader,
  deleteLoader,
  updateLoaderStatus,
  assignGamesToLoader,  // Backward compatibility
  assignProductsToAgent,  // New universal function
  unassignGamesFromLoader,  // Backward compatibility
  unassignProductsFromAgent,  // New universal function
} from '@/entities/loader'
import type {
  Loader,  // Backward compatibility alias
  Agent,  // New universal type
  LoaderStats,  // Backward compatibility alias
  AgentStats,  // New universal type
  CreateLoaderData,  // Backward compatibility alias
  CreateAgentData,  // New universal type
  UpdateLoaderData,  // Backward compatibility alias
  UpdateAgentData,  // New universal type
} from '@/entities/loader'
import type { Game, Product } from '@/entities/game'  // Game is alias for Product
import { useMutationWithCache } from './use-mutation-helpers'

// Universal terminology query keys
export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  list: () => [...agentKeys.lists()] as const,
  details: () => [...agentKeys.all, 'detail'] as const,
  detail: (id: number) => [...agentKeys.details(), id] as const,
  stats: () => [...agentKeys.all, 'stats'] as const,
  availableProducts: () => [...agentKeys.all, 'available-products'] as const,
}

// Backward compatibility alias
export const loaderKeys = agentKeys;

interface UseAgentsQueryReturn {
  agents: Agent[]  // Universal name
  loading: boolean
  error: string | null
  stats: AgentStats | null  // Universal name
  statsLoading: boolean
  products: Product[]  // Universal name
  productsLoading: boolean
  productsError: string | null

  createAgent: (data: CreateAgentData) => Promise<{ agent: any; success: boolean; message: string }>  // Universal name
  updateAgent: (id: number, data: UpdateAgentData) => Promise<{ success: boolean; message: string }>  // Universal name
  deleteAgent: (id: number) => Promise<{ success: boolean; message: string }>  // Universal name
  updateStatus: (id: number, status: 'active' | 'inactive' | 'maintenance' | 'testing') => Promise<{ success: boolean; message: string }>
  assignProducts: (agentId: number, productIds: number[]) => Promise<{ success: boolean; message: string }>  // Universal name
  unassignProducts: (agentId: number, productIds: number[]) => Promise<{ success: boolean; message: string }>  // Universal name

  refetch: () => void
  refetchStats: () => void
  refetchProducts: () => void  // Universal name
  
  // Backward compatibility aliases
  loaders: Agent[]
  games: Product[]
  gamesLoading: boolean
  gamesError: string | null
  createLoader: (data: CreateLoaderData) => Promise<{ loader: any; success: boolean; message: string }>
  updateLoader: (id: number, data: UpdateLoaderData) => Promise<{ success: boolean; message: string }>
  deleteLoader: (id: number) => Promise<{ success: boolean; message: string }>
  assignGames: (loaderId: number, gameIds: number[]) => Promise<{ success: boolean; message: string }>
  unassignGames: (loaderId: number, gameIds: number[]) => Promise<{ success: boolean; message: string }>
  refetchGames: () => void
}

// Backward compatibility alias
interface UseLoadersQueryReturn extends UseAgentsQueryReturn {}

export function useAgentsQuery(): UseAgentsQueryReturn {
  const queryClient = useQueryClient()

  const {
    data: agentsData,
    isLoading: agentsLoading,
    error: agentsError,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: agentKeys.list(),
    queryFn: async () => {
      const response = await getAgents()  // Use new universal function
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
    queryKey: agentKeys.stats(),
    queryFn: async () => {
      const response = await getAgentStats()  // Use new universal function

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
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: agentKeys.availableProducts(),
    queryFn: async () => {
      const response = await getAvailableProducts()  // Use new universal function
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

  const createAgentMutation = useMutationWithCache({
    mutationFn: createAgent,  // Use new universal function
    invalidateQueries: [agentKeys.list(), agentKeys.stats()],
    successMessage: 'Agent created successfully',
    errorMessage: 'Failed to create agent',
  })

  const updateAgentMutation = useMutationWithCache({
    mutationFn: ({ id, data }: { id: number; data: UpdateAgentData }) =>
      updateLoader(id, data),  // Function name kept for backward compatibility
    invalidateQueries: [agentKeys.list(), agentKeys.stats(), agentKeys.details()],
    successMessage: 'Agent updated successfully',
    errorMessage: 'Failed to update agent',
  })

  const deleteAgentMutation = useMutationWithCache({
    mutationFn: deleteLoader,  // Function name kept for backward compatibility
    invalidateQueries: [agentKeys.list(), agentKeys.stats()],
    successMessage: 'Agent deleted successfully',
    errorMessage: 'Failed to delete agent',
  })

  const updateStatusMutation = useMutationWithCache({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) =>
      updateLoaderStatus(id, status),  // Function name kept for backward compatibility
    invalidateQueries: [agentKeys.list(), agentKeys.stats(), agentKeys.details()],
    successMessage: 'Agent status updated successfully',
    errorMessage: 'Failed to update agent status',
  })

  const assignProductsMutation = useMutationWithCache({
    mutationFn: ({ agentId, productIds }: { agentId: number; productIds: number[] }) =>
      assignProductsToAgent(agentId, productIds),  // Use new universal function
    invalidateQueries: [agentKeys.list(), agentKeys.details()],
    successMessage: 'Products assigned successfully',
    errorMessage: 'Failed to assign products',
  })

  const unassignProductsMutation = useMutationWithCache({
    mutationFn: ({ agentId, productIds }: { agentId: number; productIds: number[] }) =>
      unassignProductsFromAgent(agentId, productIds),  // Use new universal function
    invalidateQueries: [agentKeys.list(), agentKeys.details()],
    successMessage: 'Products unassigned successfully',
    errorMessage: 'Failed to unassign products',
  })
  
  // Backward compatibility aliases
  const createLoaderMutation = createAgentMutation;
  const updateLoaderMutation = updateAgentMutation;
  const deleteLoaderMutation = deleteAgentMutation;
  const assignGamesMutation = assignProductsMutation;
  const unassignGamesMutation = unassignProductsMutation;

  const errorMessage = agentsError
    ? (agentsError as any)?.response?.data?.message ||
      (agentsError as any)?.message ||
      'Failed to load agents'
    : null

  const productsErrorMessage = productsError
    ? (productsError as any)?.response?.data?.message ||
      (productsError as any)?.message ||
      'Failed to load products'
    : null

  return {
    // Universal names
    agents: agentsData?.agents || [],
    loading: agentsLoading,
    error: errorMessage,
    stats: statsData || null,
    statsLoading,
    products: productsData?.products || [],
    productsLoading,
    productsError: productsErrorMessage,

    createAgent: createAgentMutation.mutateAsync,
    updateAgent: (id: number, data: UpdateAgentData) =>
      updateAgentMutation.mutateAsync({ id, data }),
    deleteAgent: deleteAgentMutation.mutateAsync,
    updateStatus: (id: number, status: 'active' | 'inactive' | 'maintenance' | 'testing') =>
      updateStatusMutation.mutateAsync({ id, status }),
    assignProducts: (agentId: number, productIds: number[]) =>
      assignProductsMutation.mutateAsync({ agentId, productIds }),
    unassignProducts: (agentId: number, productIds: number[]) =>
      unassignProductsMutation.mutateAsync({ agentId, productIds }),

    refetch: () => {
      refetchAgents()
      refetchStats()
    },
    refetchStats,
    refetchProducts,
    
    // Backward compatibility aliases
    loaders: agentsData?.agents || [],
    games: productsData?.products || [],
    gamesLoading: productsLoading,
    gamesError: productsErrorMessage,
    createLoader: async (data: CreateLoaderData) => {
      const result = await createLoaderMutation.mutateAsync(data);
      return { ...result, loader: result.agent };
    },
    updateLoader: (id: number, data: UpdateLoaderData) =>
      updateLoaderMutation.mutateAsync({ id, data }),
    deleteLoader: deleteLoaderMutation.mutateAsync,
    assignGames: (loaderId: number, gameIds: number[]) =>
      assignProductsMutation.mutateAsync({ agentId: loaderId, productIds: gameIds }),
    unassignGames: (loaderId: number, gameIds: number[]) =>
      unassignProductsMutation.mutateAsync({ agentId: loaderId, productIds: gameIds }),
    refetchGames: refetchProducts,
  }
}

// Backward compatibility alias
export function useLoadersQuery(): UseLoadersQueryReturn {
  return useAgentsQuery();
}
