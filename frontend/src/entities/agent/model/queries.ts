import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createQueryRetry } from '@/lib/query-retry-utils'
import { getErrorMessage } from '@/shared/api/api-error-types'
import {
  getAgents,
  getAvailableProducts,
  getAgentStats,
  createAgent,
  updateAgent,
  deleteAgent,
  updateAgentStatus,
  assignProductsToAgent,
  unassignProductsFromAgent,
} from '@/entities/agent'
import type {
  Agent,
  AgentStats,
  CreateAgentData,
  UpdateAgentData,
} from '@/entities/agent/model/types'
import type { Product } from '@/entities/product'
import { useMutationWithCache } from '@/hooks/use-mutation-helpers'

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

interface UseAgentsQueryReturn {
  agents: Agent[]
  loading: boolean
  error: string | null
  stats: AgentStats | null
  statsLoading: boolean
  products: Product[]
  productsLoading: boolean
  productsError: string | null

  createAgent: (data: CreateAgentData) => Promise<{ agent: any; success: boolean; message: string }>
  updateAgent: (id: number, data: UpdateAgentData) => Promise<{ success: boolean; message: string }>
  deleteAgent: (id: number) => Promise<{ success: boolean; message: string }>
  updateStatus: (id: number, status: 'active' | 'inactive' | 'maintenance' | 'testing') => Promise<{ success: boolean; message: string }>
  assignProducts: (agentId: number, productIds: number[]) => Promise<{ success: boolean; message: string }>
  unassignProducts: (agentId: number, productIds: number[]) => Promise<{ success: boolean; message: string }>

  refetch: () => void
  refetchStats: () => void
  refetchProducts: () => void
}

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
      const response = await getAgents()
      return response
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: createQueryRetry({ maxRetries: 2, maxRetriesRateLimit: 0 }),
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
      const response = await getAgentStats()
      return response.stats || null
    },
    staleTime: 1 * 60 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: createQueryRetry({ maxRetries: 2, maxRetriesRateLimit: 0 }),
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
      const response = await getAvailableProducts()
      return response
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: createQueryRetry({ maxRetries: 2, maxRetriesRateLimit: 0 }),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  const createAgentMutation = useMutationWithCache({
    mutationFn: createAgent,
    invalidateQueries: [agentKeys.list(), agentKeys.stats()],
    successMessage: 'Agent created successfully',
    errorMessage: 'Failed to create agent',
  })

  const updateAgentMutation = useMutationWithCache({
    mutationFn: ({ id, data }: { id: number; data: UpdateAgentData }) =>
      updateAgent(id, data),
    invalidateQueries: [agentKeys.list(), agentKeys.stats(), agentKeys.details()],
    successMessage: 'Agent updated successfully',
    errorMessage: 'Failed to update agent',
  })

  const deleteAgentMutation = useMutationWithCache({
    mutationFn: deleteAgent,
    invalidateQueries: [agentKeys.list(), agentKeys.stats()],
    successMessage: 'Agent deleted successfully',
    errorMessage: 'Failed to delete agent',
  })

  const updateStatusMutation = useMutationWithCache({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) =>
      updateAgentStatus(id, status),
    invalidateQueries: [agentKeys.list(), agentKeys.stats(), agentKeys.details()],
    successMessage: 'Agent status updated successfully',
    errorMessage: 'Failed to update agent status',
  })

  const assignProductsMutation = useMutationWithCache({
    mutationFn: ({ agentId, productIds }: { agentId: number; productIds: number[] }) =>
      assignProductsToAgent(agentId, productIds),
    invalidateQueries: [agentKeys.list(), agentKeys.details()],
    successMessage: 'Products assigned successfully',
    errorMessage: 'Failed to assign products',
  })

  const unassignProductsMutation = useMutationWithCache({
    mutationFn: ({ agentId, productIds }: { agentId: number; productIds: number[] }) =>
      unassignProductsFromAgent(agentId, productIds),
    invalidateQueries: [agentKeys.list(), agentKeys.details()],
    successMessage: 'Products unassigned successfully',
    errorMessage: 'Failed to unassign products',
  })

  const errorMessage = agentsError
    ? getErrorMessage(agentsError) || 'Failed to load agents'
    : null

  const productsErrorMessage = productsError
    ? getErrorMessage(productsError) || 'Failed to load products'
    : null

  return {
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
  }
}

