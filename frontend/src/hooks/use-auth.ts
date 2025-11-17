import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth-service'
import { useAuthState } from './auth/use-auth-state'
import { useAuthInit } from './auth/use-auth-init'
import { useAuthActions } from './auth/use-auth-actions'
import { useAuthRedirect } from './auth/use-auth-redirect'
import { useAuthErrors } from './auth/use-auth-errors'
import type { User } from '@/entities/user'

/**
 * Main authentication hook
 * Composed from smaller focused hooks following Single Responsibility Principle
 * 
 * This hook manages authentication state, initialization, actions, redirects, and errors
 * Separated into smaller hooks for better maintainability and testability
 */
export function useAuth() {
  const navigate = useNavigate()
  
  // State management
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

  // Refs for coordination between hooks
  const isLoggingIn = useRef(false)
  const loginAttempts = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isInitializing = useRef(false)
  const justLoggedIn = useRef(false)

  // Initialize authentication check
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

  // Authentication actions (login, register, logout)
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

  // Handle redirects based on auth state
  useAuthRedirect({
    isInitialized: authState.isInitialized,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    user: authState.user
  })

  // Handle authentication errors from API interceptor
  useAuthErrors({ updateState })

  // Update cache when user data changes
  useEffect(() => {
    if (authState.user) {
      authService.saveUserToCache(authState.user)
    }
  }, [authState.user])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Update user and cache
  const updateUserWithCache = (userData: Partial<User>) => {
    updateUser(userData)
    if (authState.user) {
      authService.saveUserToCache({ ...authState.user, ...userData } as User)
    }
  }

  return {
    // State
    user: authState.user,
    token: authState.token,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    error: authState.error,
    isInitialized: authState.isInitialized,

    // Actions
    login,
    register,
    registerWithInvite,
    logout,
    clearError,
    updateUser: updateUserWithCache
  }
}
