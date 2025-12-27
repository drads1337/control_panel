import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearCsrfToken } from '@/shared/lib/csrf'
import { registerAuthErrorHandler } from '@/shared/api/auth-error-handler'

interface UseAuthErrorsParams {
  updateState: (updates: any) => void
}

export function useAuthErrors(params: UseAuthErrorsParams) {
  const { updateState } = params
  const navigate = useNavigate()

  useEffect(() => {
    const handleUnauthorized = (error: { status: number; message: string; response?: any }) => {

      updateState({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
        error: error.message || 'Unauthorized access',
        isInitialized: true
      })

      document.cookie = 'access_token_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      document.cookie = 'refresh_token_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      clearCsrfToken()

      navigate('/login', { replace: true })
    }

    const unregister = registerAuthErrorHandler(handleUnauthorized)

    return () => {
      unregister()
    }
  }, [navigate, updateState])
}
