import React from 'react'
import { AuthProvider } from '@/app/providers/auth-provider'
import { SidebarProvider } from '@/app/providers/sidebar-provider'
import { NotificationProvider } from '@/app/providers/notification-provider'
import { QueryProvider, QueryErrorHandler } from '@/app/providers/query-provider'
import { ThemeProvider } from "@/app/providers/theme-provider"
import { LayoutProvider } from '@/lib/hooks'
import { ErrorBoundary } from '@/widgets/page-error-boundary'

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
