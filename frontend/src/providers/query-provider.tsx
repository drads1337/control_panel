import React, { useMemo, useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'
import { handleQueryError, handleMutationError } from '@/lib/error-handler'

interface QueryProviderProps {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create queryClient with centralized error handling
  // Note: Auth error handling is done in QueryErrorHandler component
  // to avoid circular dependency between QueryProvider and AuthProvider
  const queryClient = useMemo(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          // Время кэширования по умолчанию
          staleTime: 5 * 60 * 1000, // 5 минут
          // Время жизни кэша
          gcTime: 10 * 60 * 1000, // 10 минут (ранее cacheTime)
          // Повторные запросы при ошибках
          retry: (failureCount, error: any) => {
            // Не повторяем для 401/403 ошибок
            if (error?.response?.status === 401 || error?.response?.status === 403) {
              return false
            }
            // Для 429 ошибок (Rate Limiting) - больше попыток
            if (error?.response?.status === 429) {
              return failureCount < 5
            }
            // Повторяем до 3 раз для других ошибок
            return failureCount < 3
          },
          // Экспоненциальная задержка для retry
          retryDelay: (attemptIndex, error: any) => {
            // Для 429 ошибок используем экспоненциальную задержку
            if (error?.response?.status === 429) {
              const baseDelay = 1000
              const exponentialDelay = baseDelay * Math.pow(2, attemptIndex)
              const jitter = Math.random() * 1000
              return Math.min(exponentialDelay + jitter, 10000)
            }
            // Для других ошибок - стандартная задержка
            return Math.min(1000 * Math.pow(2, attemptIndex), 30000)
          },
          // Рефетч при фокусе окна
          refetchOnWindowFocus: false,
          // Рефетч при переподключении
          refetchOnReconnect: true,
        },
        mutations: {
          // Повторные попытки для мутаций
          retry: (failureCount, error: any) => {
            if (error?.response?.status === 401 || error?.response?.status === 403) {
              return false
            }
            // Для 429 ошибок - больше попыток
            if (error?.response?.status === 429) {
              return failureCount < 3
            }
            return failureCount < 2
          },
          // Экспоненциальная задержка для мутаций
          retryDelay: (attemptIndex, error: any) => {
            if (error?.response?.status === 429) {
              const baseDelay = 1000
              const exponentialDelay = baseDelay * Math.pow(2, attemptIndex)
              const jitter = Math.random() * 1000
              return Math.min(exponentialDelay + jitter, 10000)
            }
            return Math.min(1000 * Math.pow(2, attemptIndex), 10000)
          },
        },
      },
    })

    // Настройка специфичных конфигураций для разных типов данных
    
    // Real-time данные (сессии, heartbeat и т.д.) - более агрессивный refetchInterval
    client.setQueryDefaults(['sessions', 'realtime'], {
      staleTime: 0, // Всегда считаем устаревшими для real-time данных
      refetchInterval: 10 * 1000, // 10 секунд - более агрессивное обновление
      refetchOnWindowFocus: true, // Обновляем при фокусе для real-time данных
    })

    // Статичные данные (роли, разрешения) - более долгий staleTime
    client.setQueryDefaults(['rbac', 'roles'], {
      staleTime: 30 * 60 * 1000, // 30 минут - роли меняются редко
      gcTime: 60 * 60 * 1000, // 1 час - храним в кэше дольше
      refetchOnWindowFocus: false, // Не обновляем при фокусе
      refetchOnReconnect: false, // Не обновляем при переподключении
    })

    client.setQueryDefaults(['rbac', 'permissions'], {
      staleTime: 30 * 60 * 1000, // 30 минут - разрешения меняются еще реже
      gcTime: 60 * 60 * 1000, // 1 час
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })

    return client
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

/**
 * Check if an error is an authentication error (should trigger logout)
 * vs an authorization error (insufficient permissions, should not logout)
 * 
 * Authentication errors: Invalid token, expired session
 * Authorization errors: Insufficient permissions, permission required
 * CSRF errors: Handled separately - clear cache and retry, don't logout
 */
function isAuthenticationError(status: number, errorData?: any): boolean {
  // 401 is always an authentication error
  if (status === 401) {
    return true
  }

  // For 403, check the error message to distinguish auth vs authorization
  if (status === 403) {
    const errorMessage = (errorData?.error || errorData?.message || '').toLowerCase()
    
    // CSRF errors are handled separately in enhanced-client interceptor
    // Don't treat as authentication errors to avoid unnecessary logout
    // CSRF errors can be recovered by fetching a new token
    if (errorMessage.includes('csrf') || errorMessage === 'csrf_error') {
      return false
    }
    
    // Invalid token, authentication required are auth errors
    if (
      errorMessage.includes('invalid token') ||
      errorMessage.includes('authentication required') ||
      errorMessage.includes('unauthorized')
    ) {
      return true
    }
    
    // Note: Generic "token" check removed - too broad, might catch non-auth errors
    
    // Insufficient permissions, permission required are authorization errors (NOT auth errors)
    // Check for specific authorization error patterns
    if (
      errorMessage.includes('insufficient permissions') ||
      (errorMessage.includes('permission') && (errorMessage.includes('required') || errorMessage.includes('denied'))) ||
      errorMessage.includes('access denied')
    ) {
      return false
    }
    
    // Default: treat 403 as potentially an auth error if we can't determine
    // But be conservative - if it's clearly not an auth error, return false
    return false
  }

  return false
}

/**
 * QueryErrorHandler - Handles authentication errors from React Query
 * Must be placed after both QueryProvider and AuthProvider in the component tree
 */
export function QueryErrorHandler({ children }: { children: React.ReactNode }) {
  const { logout } = useAuthContext()
  const queryClient = useQueryClient()

  // Subscribe to query and mutation errors for authentication handling
  // Note: General error handling is done via onError callbacks in QueryClient config
  // This subscription specifically handles 401/403 errors that require logout
  useEffect(() => {
    const queryCache = queryClient.getQueryCache()
    const mutationCache = queryClient.getMutationCache()

    // Handle query errors - check for errors on 'updated' event
    const queryUnsubscribe = queryCache.subscribe((event) => {
      if (event?.type === 'updated') {
        const query = event?.query
        const error = query?.state?.error as any
        const status = error?.response?.status
        
        // Only handle authentication errors (not authorization errors)
        if (status === 401 || status === 403) {
          const errorData = error?.response?.data
          const isAuthError = isAuthenticationError(status, errorData)
          
          // Only logout for actual authentication errors, not authorization errors
          if (isAuthError) {
            // Не обрабатываем для webhooks и management page
            const queryKey = query?.queryKey
            const queryKeyString = Array.isArray(queryKey) ? queryKey.join('/') : String(queryKey || '')
            const isWebhooksEndpoint = queryKeyString.includes('/api/webhooks/')
            const isManagementPage = window.location.pathname === '/management-page'
            
            if (!isWebhooksEndpoint && !isManagementPage) {
              console.log('🔐 QUERY ERROR: Authentication error detected, calling logout')
              logout()
            }
          } else {
            // Authorization error - don't logout, just log for debugging
            console.warn('🔐 QUERY ERROR: Authorization error (insufficient permissions), not logging out:', errorData)
          }
        }
      }
    })

    // Handle mutation errors - check for errors on 'updated' event
    const mutationUnsubscribe = mutationCache.subscribe((event) => {
      if (event?.type === 'updated') {
        const mutation = event?.mutation
        const error = mutation?.state?.error as any
        const status = error?.response?.status
        
        // Only handle authentication errors (not authorization errors)
        if (status === 401 || status === 403) {
          const errorData = error?.response?.data
          const isAuthError = isAuthenticationError(status, errorData)
          
          // Only logout for actual authentication errors, not authorization errors
          if (isAuthError) {
            // Не обрабатываем для webhooks и management page
            const options = mutation?.options as any
            const url = options?.meta?.url || error?.config?.url || ''
            const isWebhooksEndpoint = url?.includes('/api/webhooks/')
            const isManagementPage = window.location.pathname === '/management-page'
            
            if (!isWebhooksEndpoint && !isManagementPage) {
              console.log('🔐 MUTATION ERROR: Authentication error detected, calling logout')
              logout()
            }
          } else {
            // Authorization error - don't logout, just log for debugging
            console.warn('🔐 MUTATION ERROR: Authorization error (insufficient permissions), not logging out:', errorData)
          }
        }
      }
    })

    return () => {
      queryUnsubscribe()
      mutationUnsubscribe()
    }
  }, [queryClient, logout])

  return <>{children}</>
}
