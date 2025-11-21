import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth-service'
import { clearCsrfToken, prefetchCsrfToken } from '@/lib/csrf'
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

export function useAuthActions(
  params: UseAuthActionsParams,
  refs: UseAuthActionsRefs
) {
  const { setUser, updateState, setError, setLoading, reset } = params
  const { isLoggingIn, loginAttempts, abortControllerRef, justLoggedIn } = refs
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)

  navigateRef.current = navigate

  // SECURITY: Removed clearCookies function
  // JWT cookies should have HttpOnly flag and cannot be accessed from JavaScript.
  // Cookies must be cleared server-side via logout endpoint which uses Set-Cookie
  // headers with expired dates. This prevents XSS attacks from stealing tokens.
  // If cookies can be read/deleted by JavaScript, they are not HttpOnly and this
  // is a critical security vulnerability.

  // SECURITY: Removed createFallbackUser function
  // Creating fallback users from login data when user data fetch fails is dangerous:
  // 1. It can cause state desynchronization with backend
  // 2. It may grant UI access based on stale/incomplete data
  // 3. Backend may have already revoked access, but frontend shows it as available
  // 4. Permissions and roles may be out of sync
  // If user data fetch fails, we should show an error and require re-authentication
  // or retry, rather than creating a potentially incorrect user object.

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

    // SECURITY: Do not manually clear cookies - they should be HttpOnly
    // and cleared by backend on login/logout
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

      // Fetch CSRF token after a short delay to ensure JWT cookies are set
      // This is non-blocking and errors are handled gracefully
      setTimeout(() => {
        prefetchCsrfToken().catch((error) => {
          // Silently handle CSRF token fetch errors - it's not critical for login
          // CSRF tokens are only needed for authenticated requests, and login is exempt
          // If the token fetch fails (e.g., cookies not set yet), it will be retried on next request
        })
      }, 100)

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
          // SECURITY: Do not create fallback user - this can cause state desynchronization
          // If user data is not available, show error and require proper authentication
          setError('Failed to load user data. Please try logging in again.')
          updateState({
            isLoading: false,
            isInitialized: true,
            isAuthenticated: false,
            user: null
          })
          // Clear auth state since we couldn't verify user
          await authService.logout()
        }
      } catch (error) {
        // SECURITY: Do not create fallback user - handle error properly instead
        // Creating fallback users can grant access based on stale data when backend
        // may have already revoked permissions
        const errorMessage = error instanceof Error
          ? error.message
          : 'Failed to load user data'
        
        setError(`Unable to verify user account: ${errorMessage}. Please try logging in again.`)
        updateState({
          isLoading: false,
          isInitialized: true,
          isAuthenticated: false,
          user: null
        })
        // Clear auth state since we couldn't verify user
        try {
          await authService.logout()
        } catch (logoutError) {
          // Ignore logout errors - we're already handling an error state
        }
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
  }, [isLoggingIn, loginAttempts, abortControllerRef, justLoggedIn, setUser, updateState, setError, setLoading])

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

    // SECURITY: Do not manually clear cookies - they should be HttpOnly
    // and cleared by backend on login/logout
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
  }, [isLoggingIn, abortControllerRef, setLoading, setError, updateState, login])

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

    // SECURITY: Do not manually clear cookies - they should be HttpOnly
    // and cleared by backend on login/logout
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
  }, [isLoggingIn, abortControllerRef, setLoading, setError, updateState, login])

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
