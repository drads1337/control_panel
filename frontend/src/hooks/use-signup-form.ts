import { useState, useCallback, useRef, useMemo } from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { enhancedApi as api } from '@/shared/api/enhanced-client'

interface SignUpFormData {
  username: string
  password: string
  inviteCode: string
  projectName: string
}

interface SignUpFormErrors {
  username?: string
  password?: string
  inviteCode?: string
  projectName?: string
  general?: string
}

interface InviteCodeInfo {
  code_type: 'referral' | 'project_invite'
  role?: string
  roles?: string[]
  project_id?: number
  game_ids?: number[]
  token_balance?: number
  expires_at?: string
  requires_project_name?: boolean
}

export function useSignUpForm() {
  const { registerWithInvite, isLoading: authIsLoading, error: authError } = useAuthContext()
  const [formData, setFormData] = useState<SignUpFormData>({
    username: '',
    password: '',
    inviteCode: '',
    projectName: ''
  })
  const [errors, setErrors] = useState<SignUpFormErrors>({})
  const [inviteCodeInfo, setInviteCodeInfo] = useState<InviteCodeInfo | null>(null)
  const [error, setError] = useState<string>('')
  const isSubmitting = useRef(false)

  const validateForm = useCallback((): boolean => {
    const newErrors: SignUpFormErrors = {}

    if (!formData.inviteCode.trim()) {
      newErrors.inviteCode = 'Invite code is required'
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (inviteCodeInfo?.code_type === 'project_invite' && inviteCodeInfo.requires_project_name && !formData.projectName.trim()) {
      newErrors.projectName = 'Project name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, inviteCodeInfo])

  const handleInputChange = useCallback((field: keyof SignUpFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }

    if (error) {
      setError('')
    }
  }, [errors, error])

  const checkInviteCode = useCallback(async (code: string) => {
    if (!code || code.trim().length === 0) {
      setInviteCodeInfo(null)
      return
    }

    try {

      const response = await api.post('/api/auth/validate_invite_code', {
        invite_code: code.trim()
      })

      setInviteCodeInfo(response.data)
      setError('')

      if (response.data.code_type === 'referral' || !response.data.requires_project_name) {
        setFormData(prev => ({ ...prev, projectName: '' }))
      }
    } catch (err: any) {
      setInviteCodeInfo(null)
      setError(err?.response?.data?.error || err?.message || 'Network error')
    }
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting.current || authIsLoading) {
      return
    }

    if (formData.inviteCode.trim()) {
      await checkInviteCode(formData.inviteCode.trim())
    }

    if (!validateForm()) {
      return
    }

    if (!inviteCodeInfo) {
      setError('Please enter a valid invite code')
      return
    }

    isSubmitting.current = true

    try {

      await registerWithInvite(
        formData.username.trim(),
        formData.password,
        formData.inviteCode.trim(),
        inviteCodeInfo?.code_type === 'project_invite' && formData.projectName.trim()
          ? formData.projectName.trim()
          : undefined
      )
    } catch (err: any) {

      setError(err.message || 'Registration failed')
    } finally {
      isSubmitting.current = false
    }
  }, [formData, validateForm, registerWithInvite, authIsLoading, inviteCodeInfo, checkInviteCode])

  const clearErrors = useCallback(() => {
    setErrors({})
    setError('')
  }, [])

  const displayError = authError || error

  const result = useMemo(() => ({
    formData,
    errors,
    isLoading: authIsLoading || isSubmitting.current,
    error: displayError,
    inviteCodeInfo,
    handleInputChange,
    handleSubmit,
    clearErrors,
    checkInviteCode,
    setInviteCodeInfo
  }), [formData, errors, authIsLoading, displayError, inviteCodeInfo, handleInputChange, handleSubmit, clearErrors, checkInviteCode])

  return result
} 