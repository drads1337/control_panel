import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { authService } from '@/shared/api/auth-service'
import { prefetchCsrfToken } from '@/shared/lib/csrf'
import { getErrorMessage } from '@/shared/lib/utils/error-utils'
import type { User } from '@/entities/user'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isInitializing = useRef(false)

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    setError(null)
    
    const controller = new AbortController()
    
    try {
      // Call login API
      const loginData = await authService.login(username, password, controller)
      
      if (!loginData.login_success) {
        throw new Error('Invalid response format: login not successful')
      }

      // Fetch CSRF token after a short delay to ensure JWT cookies are set
      // This is non-blocking and errors are handled gracefully
      setTimeout(() => {
        prefetchCsrfToken().catch((error) => {
          // Silently handle CSRF token fetch errors - it's not critical for login
          // CSRF tokens are only needed for authenticated requests, and login is exempt
        })
      }, 100)

      // Get full user data after successful login
      const userData = await authService.getFullUserData(controller)
      
      if (userData && !controller.signal.aborted) {
        // Save user to cache
        authService.saveUserToCache(userData)
        setUser(userData)
      } else {
        throw new Error('Failed to load user data. Please try logging in again.')
      }
    } catch (err: unknown) {
      // Handle abort errors silently
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      
      // Extract user-friendly error message
      const errorMessage = getErrorMessage(err) || 'Login failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await authService.logout()
      setUser(null)
      setError(null)
    } catch (err) {
      // Even if logout fails on server, clear local state
      setUser(null)
      setError(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Initialize: Check if user is already authenticated
  useEffect(() => {
    if (isInitializing.current) {
      return
    }

    // Check memory cache first
    const memoryCachedUser = authService.getCachedUserFromMemory()
    if (memoryCachedUser) {
      setUser(memoryCachedUser)
      setIsLoading(false)
      setIsInitialized(true)
      return
    }

    isInitializing.current = true
    const controller = new AbortController()

    // Fallback timeout
    const fallbackTimeout = setTimeout(() => {
      setIsLoading(false)
      setIsInitialized(true)
      isInitializing.current = false
    }, 8000)

    // Small delay to allow cookies to be restored after page reload
    const initDelay = setTimeout(() => {
      if (controller.signal.aborted) {
        return
      }

      authService
        .getCurrentUser(controller)
        .then(userData => {
          if (!controller.signal.aborted) {
            if (userData) {
              setUser(userData)
            } else {
              setUser(null)
            }
            setIsLoading(false)
            setIsInitialized(true)
          }
        })
        .catch(error => {
          if (error.name !== 'AbortError' && !controller.signal.aborted) {
            setUser(null)
            setIsLoading(false)
            setIsInitialized(true)
          }
        })
        .finally(() => {
          clearTimeout(fallbackTimeout)
          isInitializing.current = false
        })
    }, 200)

    return () => {
      clearTimeout(initDelay)
      clearTimeout(fallbackTimeout)
      if (!controller.signal.aborted) {
        controller.abort()
      }
      isInitializing.current = false
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isInitialized,
        error,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

