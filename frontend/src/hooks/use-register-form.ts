import { useState, useCallback, useRef, useMemo } from 'react'
import { useAuthContext } from '@/contexts/auth-context'

interface RegisterFormData {
  username: string
  email: string
  password: string
  confirmPassword: string
  projectName: string
}

interface RegisterFormErrors {
  username?: string
  email?: string
  password?: string
  confirmPassword?: string
  projectName?: string
  general?: string
}

export function useRegisterForm() {
  const { register, isLoading: authIsLoading, error: authError } = useAuthContext()
  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    projectName: ''
  })
  const [errors, setErrors] = useState<RegisterFormErrors>({})
  const [error, setError] = useState<string>('')
  const isSubmitting = useRef(false)

  const validateForm = useCallback((): boolean => {
    const newErrors: RegisterFormErrors = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address'
      }
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.projectName.trim()) {
      newErrors.projectName = 'Project name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleInputChange = useCallback((field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }

    // Clear confirmPassword error when password changes and vice versa
    if (field === 'password' && errors.confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: undefined }))
    }
    if (field === 'confirmPassword' && errors.password) {
      // Only clear password error if passwords now match
      if (formData.password === value) {
        setErrors(prev => ({ ...prev, password: undefined }))
      }
    }

    if (error) {
      setError('')
    }
  }, [errors, error, formData.password])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting.current || authIsLoading) {
      return
    }

    if (!validateForm()) {
      return
    }

    isSubmitting.current = true

    try {
      await register(
        formData.username.trim(),
        formData.email.trim(),
        formData.password,
        formData.projectName.trim()
      )
    } catch (err: unknown) {
      const { getErrorMessage } = await import('@/lib/error-utils')
      setError(getErrorMessage(err))
    } finally {
      isSubmitting.current = false
    }
  }, [formData, validateForm, register, authIsLoading])

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
    handleInputChange,
    handleSubmit,
    clearErrors
  }), [formData, errors, authIsLoading, displayError, handleInputChange, handleSubmit, clearErrors])

  return result
}

