import React from 'react'
import { AuthProvider } from '@/contexts/auth-context'
import { SidebarProvider } from '@/contexts/sidebar-context'
import { NotificationProvider } from '@/contexts/notification-context'
import { QueryProvider, QueryErrorHandler } from '@/providers/query-provider'
import { ThemeProvider } from '@/app/shared/theme-provider'
import { LayoutProvider } from '@/hooks/use-layout'
import { ErrorBoundary } from '@/components/error-boundary'

interface AppProvidersProps {
  children: React.ReactNode
}

/**
 * AppProviders - единый компонент, инкапсулирующий все контекст-провайдеры приложения.
 * 
 * Этот компонент устраняет "ад провайдеров" (Provider Hell) в App.tsx,
 * делая управление глобальным состоянием более наглядным и поддерживаемым.
 * 
 * Порядок провайдеров важен:
 * 1. ErrorBoundary - должен быть самым внешним для перехвата всех ошибок
 * 2. ThemeProvider - должен быть выше LayoutProvider для доступа к темам
 * 3. LayoutProvider - зависит от ThemeProvider
 * 4. QueryProvider - должен быть выше AuthProvider, так как AuthProvider использует React Query hooks
 * 5. AuthProvider - использует React Query hooks, поэтому должен быть внутри QueryProvider
 * 6. QueryErrorHandler - обрабатывает 401/403 ошибки, нужен доступ к QueryClient и AuthContext
 * 7. NotificationProvider - должен быть выше QueryProvider для показа уведомлений
 * 8. SidebarProvider - зависит от других провайдеров
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary showDetails={import.meta.env.DEV}>
      <ThemeProvider>
        <LayoutProvider>
          <QueryProvider>
            <AuthProvider>
              <QueryErrorHandler>
                <NotificationProvider>
                  <SidebarProvider>
                    {children}
                  </SidebarProvider>
                </NotificationProvider>
              </QueryErrorHandler>
            </AuthProvider>
          </QueryProvider>
        </LayoutProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

