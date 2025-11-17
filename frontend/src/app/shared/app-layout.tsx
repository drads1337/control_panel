import React from 'react'
import AppSidebar from './app-sidebar'
import { AppHeader } from './app-header'
import { AppFooter } from './app-footer'

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
    <div className="flex h-screen bg-background dark:bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
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
    </div>
  )
}
