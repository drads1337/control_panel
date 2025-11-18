import { useState, useCallback, useRef, useMemo } from 'react'
import { useAuthContext } from '@/contexts/auth-context'
interface LoginFormData {
  username: string
  password: string
}
interface LoginFormErrors {
  username?: string
  password?: string
  general?: string
}
export function useLoginForm() {
  const { login, isLoading, error } = useAuthContext()
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  })
  const [errors, setErrors] = useState<LoginFormErrors>({})
  const isSubmitting = useRef(false)
  const validateForm = useCallback((): boolean => {
    const newErrors: LoginFormErrors = {}
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    }
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])
  const handleInputChange = useCallback((field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }, [errors])
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting.current || isLoading) {
      return
    }
    if (!validateForm()) {
      return
    }
    isSubmitting.current = true
    try {
      await login(formData.username.trim(), formData.password)
    } catch (error) {
    } finally {
      isSubmitting.current = false
    }
  }, [formData, validateForm, login, isLoading])
  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])
  const result = useMemo(() => ({
    formData,
    errors,
    isLoading: isLoading || isSubmitting.current,
    error,
    handleInputChange,
    handleSubmit,
    clearErrors
  }), [formData, errors, isLoading, error, handleInputChange, handleSubmit, clearErrors])
  return result
} 