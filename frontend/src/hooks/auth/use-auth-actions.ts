import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth-service'
import { clearCsrfToken } from '@/lib/csrf'
import type { User } from '@/entities/user'

interface UseAuthActionsParams {
  setUser: (user: User | null) => void
  updateState: (updates: any) => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

interface UseAuthActionsRefs {
  isLoggingIn: React.MutableRefObject<boolean>
  loginAttempts: React.MutableRefObject<number>
  abortControllerRef: React.MutableRefObject<AbortController | null>
  justLoggedIn: React.MutableRefObject<boolean>
}

const MAX_LOGIN_ATTEMPTS = 3

/**
 * Hook for authentication actions (login, register, logout)
 * Separated from state management for better organization
 */
export function useAuthActions(
  params: UseAuthActionsParams,
  refs: UseAuthActionsRefs
) {
  const { setUser, updateState, setError, setLoading, reset } = params
  const { isLoggingIn, loginAttempts, abortControllerRef, justLoggedIn } = refs
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  
  // Keep navigate ref updated
  navigateRef.current = navigate

  const clearCookies = useCallback(() => {
    document.cookie = 'access_token_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'refresh_token_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  }, [])

  const createFallbackUser = useCallback((data: any, username: string): User => {
    return {
      id: parseInt(data.user_id || '0') || 0,
      username: data.username || username,
      roles: data.roles || [data.role || 'user'],
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      email: data.email || null,
      avatar: data.avatar || null,
      expires_at: data.expires_at || null,
      last_login: data.last_login || null,
      last_ip: data.last_ip || null,
      last_country: data.last_country || null,
      last_city: data.last_city || null,
      total_keys_generated: data.total_keys_generated || 0,
      token_balance: data.token_balance || 0,
      project_id: data.project_id || null,
      keys_count: data.keys_count || 0,
      active_keys: data.active_keys || 0,
      referral_code: data.referral_code || null,
      invited_by: data.invited_by || null,
      created_at: data.created_at || null,
      updated_at: data.updated_at || null,
      rbac_roles: Array.isArray(data.rbac_roles) && 
        data.rbac_roles.length > 0 && 
        typeof data.rbac_roles[0] === 'object' 
        ? (data.rbac_roles as unknown as Array<{ 
            id: number
            name: string
            description: string
            assigned_at: string 
          }>)
        : undefined
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    if (isLoggingIn.current) {
      return
    }

    if (loginAttempts.current >= MAX_LOGIN_ATTEMPTS) {
      setError('Too many login attempts. Please wait before trying again.')
      setLoading(false)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    clearCookies()
    isLoggingIn.current = true
    loginAttempts.current++
    setLoading(true)
    setError(null)

    setTimeout(() => {
      loginAttempts.current = 0
    }, 5 * 60 * 1000)

    try {
      const data = await authService.login(username, password, controller)
      
      if (!data.login_success) {
        throw new Error('Invalid response format: login not successful')
      }

      loginAttempts.current = 0
      const isClassicUser = data.login_type === 'classic_web'

      try {
        const userData = await authService.getFullUserData(controller)
        
        if (userData && !controller.signal.aborted) {
          const userWithClassicFlag = { ...userData, isClassicUser }
          setUser(userWithClassicFlag)
          updateState({
            isLoading: false,
            isInitialized: true,
            error: null
          })
          justLoggedIn.current = true
          setTimeout(() => {
            justLoggedIn.current = false
          }, 5000)
        } else {
          // Fallback to basic user info
          const fallbackUser = createFallbackUser(data, username)
          authService.saveUserToCache(fallbackUser)
          setUser(fallbackUser)
          updateState({
            isLoading: false,
            isInitialized: true,
            error: null
          })
          justLoggedIn.current = true
          setTimeout(() => {
            justLoggedIn.current = false
          }, 5000)
        }
      } catch (error) {
        // Fallback to basic user info from login response
        const fallbackUser = createFallbackUser(data, username)
        authService.saveUserToCache(fallbackUser)
        setUser(fallbackUser)
        updateState({
          isLoading: false,
          isInitialized: true,
          error: null
        })
        justLoggedIn.current = true
        setTimeout(() => {
          justLoggedIn.current = false
        }, 5000)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      const errorMessage = error instanceof Error
        ? (error.message === 'Request timeout'
          ? 'Login request timed out. Please check your connection and try again.'
          : error.message)
        : 'An error occurred during login'

      setError(errorMessage)
      updateState({
        isLoading: false,
        isInitialized: true
      })
    } finally {
      isLoggingIn.current = false
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
    }
  }, [isLoggingIn, loginAttempts, abortControllerRef, justLoggedIn, setUser, updateState, setError, setLoading, clearCookies, createFallbackUser])

  const register = useCallback(async (
    username: string,
    email: string,
    password: string,
    referralCode?: string
  ) => {
    if (isLoggingIn.current) {
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    clearCookies()
    isLoggingIn.current = true
    setLoading(true)
    setError(null)

    try {
      await authService.register(username, email, password, referralCode, controller)
      await login(username, password)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      const errorMessage = error instanceof Error
        ? (error.message === 'Request timeout'
          ? 'Registration request timed out. Please check your connection and try again.'
          : error.message)
        : 'An error occurred during registration'

      setError(errorMessage)
      updateState({
        isLoading: false,
        isInitialized: true
      })
      throw error
    } finally {
      isLoggingIn.current = false
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
    }
  }, [isLoggingIn, abortControllerRef, setLoading, setError, updateState, clearCookies, login])

  const registerWithInvite = useCallback(async (
    username: string,
    password: string,
    inviteCode: string,
    projectName?: string
  ) => {
    if (isLoggingIn.current) {
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    clearCookies()
    isLoggingIn.current = true
    setLoading(true)
    setError(null)

    try {
      await authService.registerWithInvite(username, password, inviteCode, projectName, controller)
      await login(username, password)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      const errorMessage = error instanceof Error
        ? (error.message === 'Request timeout'
          ? 'Registration request timed out. Please check your connection and try again.'
          : error.message)
        : 'An error occurred during registration'

      setError(errorMessage)
      updateState({
        isLoading: false,
        isInitialized: true
      })
      throw error
    } finally {
      isLoggingIn.current = false
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
    }
  }, [isLoggingIn, abortControllerRef, setLoading, setError, updateState, clearCookies, login])

  const logout = useCallback(async () => {
    if (isLoggingIn.current) {
      return
    }

    isLoggingIn.current = true

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      reset()
      authService.clearCache()
      clearCsrfToken()
      loginAttempts.current = 0

      await authService.logout()
      
      // Set loading to false and initialized to true after logout completes
      // This prevents the spinner from showing on the login page
      updateState({
        isLoading: false,
        isInitialized: true,
        isAuthenticated: false,
        user: null
      })
      
      navigateRef.current('/login')
    } finally {
      isLoggingIn.current = false
    }
  }, [isLoggingIn, abortControllerRef, reset, loginAttempts, navigate, updateState])

  return {
    login,
    register,
    registerWithInvite,
    logout
  }
}

