import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { useAuthContext } from '@/contexts/auth-context'
import { toast } from 'sonner'

// Types
export interface ReferralCode {
  id: number
  code: string
  expires_days?: number
  work_duration_days?: number
  game_ids?: number[]
  rbac_role_ids?: number[]
  token_balance?: number
  used?: boolean
  is_expired?: boolean
  created_at: string
  expires_at?: string
  role?: string
}

export interface CreateReferralCodeData {
  code: string
  expires_days?: number
  work_duration_days?: number
  game_ids?: number[]
  rbac_role_ids?: number[]
  token_balance?: number
}

// Cache keys
export const referralKeys = {
  all: ['referrals'] as const,
  codes: () => [...referralKeys.all, 'codes'] as const,
}

/**
 * Hook for fetching referral codes
 */
export function useReferralCodes() {
  const { isAuthenticated } = useAuthContext()

  return useQuery({
    queryKey: referralKeys.codes(),
    queryFn: async (): Promise<ReferralCode[]> => {
      const response = await api.get<ReferralCode[]>('/api/users/refcodes')
      return Array.isArray(response.data) ? response.data : []
    },
    enabled: isAuthenticated,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      // Don't retry on rate limit errors
      if (error?.response?.status === 429) {
        return false
      }
      // Retry up to 2 times for other errors
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })
}

/**
 * Hook for creating a referral code
 */
export function useCreateReferralCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateReferralCodeData): Promise<ReferralCode> => {
      const response = await api.post<ReferralCode>('/api/users/refcodes', {
        code: data.code,
        expires_days: data.expires_days || 7,
        work_duration_days: data.work_duration_days || 7,
        rbac_role_ids: data.rbac_role_ids || [],
        game_ids: data.game_ids || [],
        token_balance: data.token_balance || 0,
      })
      return response.data
    },
    onSuccess: () => {
      // Invalidate and refetch referral codes
      queryClient.invalidateQueries({ queryKey: referralKeys.codes() })
      toast.success('Referral code created successfully')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to create referral code'
      toast.error(errorMessage)
    },
  })
}

/**
 * Combined hook for referral code operations
 */
export function useReferrals() {
  const codesQuery = useReferralCodes()
  const createCodeMutation = useCreateReferralCode()

  return {
    // Query data
    codes: codesQuery.data || [],
    isLoading: codesQuery.isLoading,
    error: codesQuery.error,
    
    // Mutations
    createCode: createCodeMutation.mutateAsync,
    isCreating: createCodeMutation.isPending,
    
    // Refetch function
    refetch: codesQuery.refetch,
  }
}

