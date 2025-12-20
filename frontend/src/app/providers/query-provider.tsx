import React, { useMemo, useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/app/providers/auth-provider'
import { handleQueryError, handleMutationError } from '@/lib/error-handler'
import { setupQueryErrorHandler } from '@/lib/api/query-error-handler'

interface QueryProviderProps {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {

  const queryClient = useMemo(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 10 * 60 * 1000,

          gcTime: 30 * 60 * 1000,

          refetchOnMount: (query) => {
            return query.state.dataUpdatedAt === 0 || query.isStale()
          },

          retry: (failureCount, error: any) => {

            if (error?.response?.status === 401 || error?.response?.status === 403) {
              return false
            }

            if (error?.response?.status === 429) {
              return failureCount < 5
            }

            return failureCount < 3
          },

          retryDelay: (attemptIndex, error: any) => {

            if (error?.response?.status === 429) {
              const baseDelay = 1000
              const exponentialDelay = baseDelay * Math.pow(2, attemptIndex)
              const jitter = Math.random() * 1000
              return Math.min(exponentialDelay + jitter, 10000)
            }

            return Math.min(1000 * Math.pow(2, attemptIndex), 30000)
          },

          refetchOnWindowFocus: false,

          refetchOnReconnect: true,
        },
        mutations: {

          retry: (failureCount, error: any) => {
            if (error?.response?.status === 401 || error?.response?.status === 403) {
              return false
            }

            if (error?.response?.status === 429) {
              return failureCount < 3
            }
            return failureCount < 2
          },

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

    setupQueryErrorHandler(client)

    client.setQueryDefaults(['sessions', 'realtime'], {
      staleTime: 0,
      refetchInterval: 10 * 1000,
      refetchOnWindowFocus: true,
    })

    client.setQueryDefaults(['rbac', 'roles'], {
      staleTime: 30 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })

    client.setQueryDefaults(['rbac', 'permissions'], {
      staleTime: 30 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })

    client.setQueryDefaults(['products', 'list'], {
      staleTime: 15 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
    })

    client.setQueryDefaults(['users', 'list'], {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    })

    client.setQueryDefaults(['agents', 'list'], {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    })

    client.setQueryDefaults(['settings'], {
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    })

    client.setQueryDefaults(['navigation', 'config'], {
      staleTime: 15 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
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

function isAuthenticationError(status: number, errorData?: any): boolean {

  if (status === 401) {
    return true
  }

  if (status === 403) {
    const errorMessage = (errorData?.error || errorData?.message || '').toLowerCase()

    if (errorMessage.includes('csrf') || errorMessage === 'csrf_error') {
      return false
    }

    if (
      errorMessage.includes('invalid token') ||
      errorMessage.includes('authentication required') ||
      errorMessage.includes('unauthorized')
    ) {
      return true
    }

    if (
      errorMessage.includes('insufficient permissions') ||
      (errorMessage.includes('permission') && (errorMessage.includes('required') || errorMessage.includes('denied'))) ||
      errorMessage.includes('access denied')
    ) {
      return false
    }

    return false
  }

  return false
}

export function QueryErrorHandler({ children }: { children: React.ReactNode }) {
  const { logout } = useAuthContext()
  const queryClient = useQueryClient()

  useEffect(() => {
    const queryCache = queryClient.getQueryCache()
    const mutationCache = queryClient.getMutationCache()

    const queryUnsubscribe = queryCache.subscribe((event) => {
      if (event?.type === 'updated') {
        const query = event?.query
        const error = query?.state?.error as any
        const status = error?.response?.status

        if (status === 401 || status === 403) {
          const errorData = error?.response?.data
          const isAuthError = isAuthenticationError(status, errorData)

          if (isAuthError) {

            const queryKey = query?.queryKey
            const queryKeyString = Array.isArray(queryKey) ? queryKey.join('/') : String(queryKey || '')
            const isWebhooksEndpoint = queryKeyString.includes('/api/webhooks/')
            const isManagementPage = window.location.pathname === '/management-page'

            if (!isWebhooksEndpoint && !isManagementPage) {

              logout()
            }
          }
        }
      }
    })

    const mutationUnsubscribe = mutationCache.subscribe((event) => {
      if (event?.type === 'updated') {
        const mutation = event?.mutation
        const error = mutation?.state?.error as any
        const status = error?.response?.status

        if (status === 401 || status === 403) {
          const errorData = error?.response?.data
          const isAuthError = isAuthenticationError(status, errorData)

          if (isAuthError) {

            const options = mutation?.options as any
            const url = options?.meta?.url || error?.config?.url || ''
            const isWebhooksEndpoint = url?.includes('/api/webhooks/')
            const isManagementPage = window.location.pathname === '/management-page'

            if (!isWebhooksEndpoint && !isManagementPage) {

              logout()
            }
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

