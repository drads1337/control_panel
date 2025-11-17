import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearCsrfToken } from '@/lib/csrf'
import { registerAuthErrorHandler } from '@/shared/api/auth-error-handler'

interface UseAuthErrorsParams {
  updateState: (updates: any) => void
}

/**
 * Hook for handling authentication errors from API interceptor
 * Separated for better organization
 */
export function useAuthErrors(params: UseAuthErrorsParams) {
  const { updateState } = params
  const navigate = useNavigate()

  useEffect(() => {
    const handleUnauthorized = (error: { status: number; message: string; response?: any }) => {
      // Update auth state to unauthenticated
      updateState({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
        error: error.message || 'Unauthorized access',
        isInitialized: true
      })

      // Clear cookies and CSRF token
      document.cookie = 'access_token_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      document.cookie = 'refresh_token_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      clearCsrfToken()

      // Redirect to login
      navigate('/login', { replace: true })
    }

    // Register handler - returns unregister function
    const unregister = registerAuthErrorHandler(handleUnauthorized)

    return () => {
      unregister()
    }
  }, [navigate, updateState])
}

