import { useEffect, useRef } from 'react'
import { authService } from '@/services/auth-service'

interface UseAuthInitParams {
  setUser: (user: any) => void
  updateState: (updates: any) => void
  onInitialized?: () => void
}

interface UseAuthInitRefs {
  isLoggingIn: React.MutableRefObject<boolean>
  justLoggedIn: React.MutableRefObject<boolean>
  abortControllerRef: React.MutableRefObject<AbortController | null>
  isInitializing: React.MutableRefObject<boolean>
}

/**
 * Hook for initializing authentication check
 * Handles caching and API verification
 */
export function useAuthInit(
  params: UseAuthInitParams,
  refs: UseAuthInitRefs
) {
  const { setUser, updateState, onInitialized } = params
  const { isLoggingIn, justLoggedIn, abortControllerRef, isInitializing } = refs

  useEffect(() => {
    // Skip if already initialized or if login/registration is in progress
    if (isInitializing.current || isLoggingIn.current || justLoggedIn.current) {
      return
    }

    // Check cache first for fast initial load
    const cachedUser = authService.getCachedUser()
    if (cachedUser?.user) {
      setUser(cachedUser.user)
      updateState({ isLoading: false, isInitialized: true })
      onInitialized?.()
      return
    }

    // Fallback to memory cache
    const memoryCachedUser = authService.getCachedUserFromMemory()
    if (memoryCachedUser) {
      setUser(memoryCachedUser)
      updateState({ isLoading: false, isInitialized: true })
      onInitialized?.()
      return
    }

    // Perform API check
    isInitializing.current = true
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Fallback timeout to ensure loading state is cleared
    const fallbackTimeout = setTimeout(() => {
      if (isInitializing.current) {
        updateState({ isLoading: false, isInitialized: true })
        isInitializing.current = false
        onInitialized?.()
      }
    }, 5000)

    const cleanup = () => {
      if (!controller.signal.aborted) {
        controller.abort()
      }
      clearTimeout(fallbackTimeout)
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      isInitializing.current = false
    }

    authService
      .getCurrentUser(controller)
      .then(userData => {
        if (!controller.signal.aborted && userData) {
          setUser(userData)
          updateState({
            isLoading: false,
            isInitialized: true,
            error: null
          })
          onInitialized?.()
        } else if (!userData) {
          updateState({
            user: null,
            isAuthenticated: false,
            token: null,
            isLoading: false,
            isInitialized: true,
            error: null
          })
          onInitialized?.()
        }
      })
      .catch(error => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          updateState({
            user: null,
            isAuthenticated: false,
            token: null,
            isLoading: false,
            isInitialized: true,
            error: null
          })
          onInitialized?.()
        }
      })
      .finally(() => {
        clearTimeout(fallbackTimeout)
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
        isInitializing.current = false
      })

    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once on mount - refs are stable, callbacks are from useAuthState
}

