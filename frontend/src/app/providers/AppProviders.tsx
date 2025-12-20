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
