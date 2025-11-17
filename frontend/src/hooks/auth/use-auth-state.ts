import { useState, useCallback } from 'react'
import type { User } from '@/entities/user'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isInitialized: boolean
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  isInitialized: false
}

/**
 * Hook for managing authentication state
 * Separated from business logic for better reusability and testability
 */
export function useAuthState() {
  const [authState, setAuthState] = useState<AuthState>(initialState)

  const setUser = useCallback((user: User | null) => {
    setAuthState(prev => ({
      ...prev,
      user,
      isAuthenticated: !!user,
      token: null // Token is stored in httpOnly cookies
    }))
  }, [])

  const setLoading = useCallback((isLoading: boolean) => {
    setAuthState(prev => ({ ...prev, isLoading }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setAuthState(prev => ({ ...prev, error }))
  }, [])

  const setInitialized = useCallback((isInitialized: boolean) => {
    setAuthState(prev => ({ ...prev, isInitialized }))
  }, [])

  const updateState = useCallback((updates: Partial<AuthState>) => {
    setAuthState(prev => ({ ...prev, ...updates }))
  }, [])

  const updateUser = useCallback((userData: Partial<User>) => {
    setAuthState(prev => {
      const updatedUser = prev.user ? { ...prev.user, ...userData } : null
      return {
        ...prev,
        user: updatedUser,
        isAuthenticated: !!updatedUser
      }
    })
  }, [])

  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }))
  }, [])

  const reset = useCallback(() => {
    setAuthState(initialState)
  }, [])

  return {
    authState,
    setUser,
    setLoading,
    setError,
    setInitialized,
    updateState,
    updateUser,
    clearError,
    reset
  }
}

