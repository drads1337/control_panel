import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { enhancedApi as api } from '@/lib/api/enhanced-client'
import { useAuthContext } from '@/app/providers/auth-provider'
import { toast } from 'sonner'

export interface ReferralCodeRole {
  id: number
  name: string
  description?: string
  is_system_role?: boolean
}

export interface ReferralCode {
  id: number
  code: string
  expires_days?: number
  work_duration_days?: number
  product_ids?: number[]
  rbac_role_ids?: number[]
  roles?: ReferralCodeRole[]
  token_balance?: number
  used?: boolean
  is_expired?: boolean
  created_at: string
  expires_at?: string
  role?: string // Legacy field, use roles array instead
}

export interface CreateReferralCodeData {
  code: string
  expires_days?: number
  work_duration_days?: number
  product_ids?: number[]
  rbac_role_ids?: number[]
  token_balance?: number
}

export const referralKeys = {
  all: ['referrals'] as const,
  codes: () => [...referralKeys.all, 'codes'] as const,
}

export function useReferralCodes() {
  const { isAuthenticated } = useAuthContext()

  return useQuery({
    queryKey: referralKeys.codes(),
    queryFn: async (): Promise<ReferralCode[]> => {
      const response = await api.get<ReferralCode[]>('/api/users/refcodes')
      return Array.isArray(response.data) ? response.data : []
    },
    enabled: isAuthenticated,
    staleTime: 1 * 60 * 1000,
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
}

export function useCreateReferralCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateReferralCodeData): Promise<ReferralCode> => {
      const response = await api.post<ReferralCode>('/api/users/refcodes', {
        code: data.code,
        expires_days: data.expires_days || 7,
        work_duration_days: data.work_duration_days || 7,
        rbac_role_ids: data.rbac_role_ids || [],
        product_ids: data.product_ids || [],
        token_balance: data.token_balance || 0,
      })
      return response.data
    },
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: referralKeys.codes() })
      toast.success('Referral code created successfully')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to create referral code'
      toast.error(errorMessage)
    },
  })
}

export function useDeleteReferralCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (codeId: number): Promise<void> => {
      await api.delete(`/api/users/refcodes/${codeId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.codes() })
      toast.success('Referral code deleted successfully')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to delete referral code'
      toast.error(errorMessage)
    },
  })
}

export function useReferrals() {
  const codesQuery = useReferralCodes()
  const createCodeMutation = useCreateReferralCode()
  const deleteCodeMutation = useDeleteReferralCode()

  return {

    codes: codesQuery.data || [],
    isLoading: codesQuery.isLoading,
    error: codesQuery.error,

    createCode: createCodeMutation.mutateAsync,
    isCreating: createCodeMutation.isPending,

    deleteCode: deleteCodeMutation.mutateAsync,
    isDeleting: deleteCodeMutation.isPending,

    refetch: codesQuery.refetch,
  }
}
