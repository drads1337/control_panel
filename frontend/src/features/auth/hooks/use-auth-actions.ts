import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/shared/api/auth-service'
import { clearCsrfToken, prefetchCsrfToken } from '@/shared/lib/csrf'
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
    console.log('[AUTH] Login attempt started', { 
      username, 
      attempt: loginAttempts.current + 1,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
      isAlreadyLoggingIn: isLoggingIn.current
    })

    if (isLoggingIn.current) {
      console.warn('[AUTH] Login already in progress, ignoring request')
      return
    }

    if (loginAttempts.current >= MAX_LOGIN_ATTEMPTS) {
      console.error('[AUTH] Max login attempts reached', { attempts: loginAttempts.current })
      setError('Too many login attempts. Please wait before trying again.')
      setLoading(false)
      return
    }

    if (abortControllerRef.current) {
      console.log('[AUTH] Aborting previous login attempt')
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    // SECURITY: Do not manually clear cookies - they should be HttpOnly
    // and cleared by backend on login/logout
    // Clear user cache to ensure fresh data is fetched for the newly logged-in user
    authService.clearCache()
    isLoggingIn.current = true
    loginAttempts.current++
    setLoading(true)
    setError(null)

    setTimeout(() => {
      loginAttempts.current = 0
    }, 5 * 60 * 1000)

    try {
      console.log('[AUTH] Calling authService.login')
      const data = await authService.login(username, password, controller)
      console.log('[AUTH] Login API call successful', { 
        login_success: data.login_success,
        login_type: data.login_type,
        user_id: data.user_id
      })

      if (!data.login_success) {
        throw new Error('Invalid response format: login not successful')
      }

      loginAttempts.current = 0
      const isClassicUser = data.login_type === 'classic_web'

      // Add a small delay before fetching user data to avoid rate limiting
      // This gives the server time to process the login and reduces concurrent requests
      console.log('[AUTH] Waiting 300ms before fetching user data to avoid rate limiting')
      await new Promise(resolve => setTimeout(resolve, 300))

      // Fetch CSRF token after a short delay to ensure JWT cookies are set
      // This is non-blocking and errors are handled gracefully
      setTimeout(() => {
        console.log('[AUTH] Fetching CSRF token')
        prefetchCsrfToken().catch((error) => {
          console.warn('[AUTH] CSRF token fetch failed (non-critical)', error)
        })
      }, 500)

      try {
        console.log('[AUTH] Fetching full user data')
        const userData = await authService.getFullUserData(controller)
        console.log('[AUTH] User data fetched', { 
          hasUserData: !!userData,
          userId: userData?.id,
          username: userData?.username
        })

        if (userData && !controller.signal.aborted) {
          console.log('[AUTH] Login successful, setting user state')
          const userWithClassicFlag = { ...userData, isClassicUser }
          setUser(userWithClassicFlag)
          updateState({
            isLoading: false,
            isInitialized: true,
            isAuthenticated: true,
            error: null
          })
          justLoggedIn.current = true
          console.log('[AUTH] Login complete, user authenticated', { userId: userData.id })
          
          // Explicitly navigate to dashboard after successful login
          // Use a small delay to ensure state updates have been processed
          // This ensures redirect happens even if useAuthRedirect hook has timing issues
          setTimeout(() => {
            const currentPath = window.location.pathname
            // Redirect from login/signup pages, root, or management-page to dashboard after login
            const shouldRedirect = currentPath === '/login' || 
                                   currentPath === '/signup' || 
                                   currentPath === '/' ||
                                   currentPath === '/management-page'
            
            console.log('[AUTH] Checking navigation after login', { 
              currentPath, 
              shouldNavigate: shouldRedirect,
              hasNavigateRef: !!navigateRef.current,
              navigateType: typeof navigateRef.current
            })
            
            if (shouldRedirect) {
              console.log('[AUTH] Navigating to dashboard after login', { from: currentPath })
              try {
                if (navigateRef.current) {
                  navigateRef.current('/dashboard')
                  console.log('[AUTH] Navigation called successfully')
                } else {
                  console.error('[AUTH] navigateRef.current is null or undefined')
                  // Fallback: use window.location as last resort
                  window.location.href = '/dashboard'
                }
              } catch (error) {
                console.error('[AUTH] Navigation error', error)
                // Fallback: use window.location as last resort
                window.location.href = '/dashboard'
              }
            } else {
              console.log('[AUTH] Not navigating - already on different page', { currentPath })
            }
          }, 100)
          
          setTimeout(() => {
            justLoggedIn.current = false
          }, 5000)
        } else {
          console.error('[AUTH] User data not available or request aborted', {
            hasUserData: !!userData,
            isAborted: controller.signal.aborted
          })
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
      } catch (error: unknown) {
        console.error('[AUTH] Error fetching user data after login', error)
        // SECURITY: Do not create fallback user - handle error properly instead
        // Creating fallback users can grant access based on stale data when backend
        // may have already revoked permissions
        const errorMessage = error instanceof Error
          ? error.message
          : 'Failed to load user data'
        
        console.error('[AUTH] User data fetch failed', { errorMessage })
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
        } catch (logoutError: unknown) {
          console.warn('[AUTH] Logout after error failed (ignoring)', logoutError)
          // Ignore logout errors - we're already handling an error state
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[AUTH] Login request aborted')
        return
      }

      console.error('[AUTH] Login failed', error)
      
      // Use getErrorMessage to properly extract user-friendly error messages from axios errors
      let errorMessage: string
      try {
        const { getErrorMessage } = await import('@/shared/api/enhanced-client')
        const { getErrorStatus } = await import('@/shared/lib/utils/error-utils')
        const status = getErrorStatus ? getErrorStatus(error) : undefined
        errorMessage = getErrorMessage(error)
        console.error('[AUTH] Login error details', { 
          status,
          errorMessage,
          errorType: error instanceof Error ? error.constructor.name : typeof error
        })
      } catch {
        // Fallback if getErrorMessage is not available
        errorMessage = error instanceof Error
          ? (error.message === 'Request timeout'
            ? 'Login request timed out. Please check your connection and try again.'
            : error.message)
          : 'An error occurred during login'
        console.error('[AUTH] Login error (fallback message)', { errorMessage })
      }

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
    projectName?: string,
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
      await authService.register(username, email, password, projectName, referralCode, controller)
      await login(username, password)
    } catch (error: unknown) {
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
    email?: string,
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
      await authService.registerWithInvite(username, password, inviteCode, email, projectName, controller)
      await login(username, password)
    } catch (error: unknown) {
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
