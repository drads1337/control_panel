import React from 'react'
import { AppSidebarInner } from './app-sidebar'
import { AppHeader } from './app-header'
import { AppFooter } from './app-footer'
import { SidebarInset, SidebarProvider } from '@/components/animate-ui/components/radix/sidebar'

interface AppLayoutProps {
  children: React.ReactNode
  title: string
  headerActions?: React.ReactNode
  showSearch?: boolean
}

export function AppLayout({ 
  children, 
  title, 
  headerActions, 
  showSearch = true 
}: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebarInner />
      <SidebarInset>
        <div className="flex flex-col h-screen overflow-hidden">
          <AppHeader title={title} showSearch={showSearch}>
            {headerActions}
          </AppHeader>
          <main className="flex-1 overflow-y-auto px-6 pt-6">
            <div className="pb-6">
              {children}
            </div>
          </main>
          <AppFooter />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
