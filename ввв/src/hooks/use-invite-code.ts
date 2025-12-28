import { useState, useCallback } from 'react'
import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { getErrorMessage, isAxiosError } from '@/lib/error-utils'
export interface InviteCodeInfo {
  code_type: 'referral' | 'project_invite'
  role?: string
  roles?: string[]
  project_id?: number
  product_ids?: number[]
  token_balance?: number
  expires_at?: string
  requires_project_name?: boolean
}
export function useInviteCode() {
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codeInfo, setCodeInfo] = useState<InviteCodeInfo | null>(null)
  const validateCode = useCallback(async (inviteCode: string): Promise<InviteCodeInfo | null> => {
    if (!inviteCode.trim()) {
      setError('Invite code is required')
      return null
    }
    setIsValidating(true)
    setError(null)
    setCodeInfo(null)
    try {
      const response = await api.post('/api/validate_invite_code', {
        invite_code: inviteCode.trim()
      })
      setCodeInfo(response.data)
      return response.data
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        const errorMessage = errorData.error || getErrorMessage(err)
        setError(errorMessage)
      } else {
        setError(getErrorMessage(err))
      }
      return null
    } finally {
      setIsValidating(false)
    }
  }, [])
  const clearCodeInfo = useCallback(() => {
    setCodeInfo(null)
    setError(null)
  }, [])
  return {
    validateCode,
    clearCodeInfo,
    isValidating,
    error,
    codeInfo
  }
} 