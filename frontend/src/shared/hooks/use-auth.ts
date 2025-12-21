import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/shared/api/auth-service'
import { useAuthState } from '@/features/auth/hooks/use-auth-state'
import { useAuthInit } from '@/features/auth/hooks/use-auth-init'
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useAuthErrors } from '@/features/auth/hooks/use-auth-errors'
import type { User } from '@/entities/user'

export function useAuth() {
  const navigate = useNavigate()

  const {
    authState,
    setUser,
    setLoading,
    setError,
    setInitialized,
    updateState,
    updateUser,
    clearError,
    reset
  } = useAuthState()

  const isLoggingIn = useRef(false)
  const loginAttempts = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isInitializing = useRef(false)
  const justLoggedIn = useRef(false)

  useAuthInit(
    {
      setUser,
      updateState,
      onInitialized: () => {
        setInitialized(true)
      }
    },
    {
      isLoggingIn,
      justLoggedIn,
      abortControllerRef,
      isInitializing
    }
  )

  const { login, register, registerWithInvite, logout } = useAuthActions(
    {
      setUser,
      updateState,
      setError,
      setLoading,
      reset
    },
    {
      isLoggingIn,
      loginAttempts,
      abortControllerRef,
      justLoggedIn
    }
  )

  useAuthRedirect({
    isInitialized: authState.isInitialized,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    user: authState.user
  })

  useAuthErrors({ updateState })

  useEffect(() => {
    if (authState.user) {
      authService.saveUserToCache(authState.user)
    }
  }, [authState.user])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const updateUserWithCache = (userData: Partial<User>) => {
    updateUser(userData)
    if (authState.user) {
      authService.saveUserToCache({ ...authState.user, ...userData } as User)
    }
  }

  return {

    user: authState.user,
    token: authState.token,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    error: authState.error,
    isInitialized: authState.isInitialized,

    login,
    register,
    registerWithInvite,
    logout,
    clearError,
    updateUser: updateUserWithCache
  }
}
