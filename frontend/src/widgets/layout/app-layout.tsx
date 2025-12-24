import React from 'react'
import { AppHeader } from '@/widgets/header'
import { AppFooter } from './footer'

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
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-gray-800 dark:text-text-primary-dark font-body">
      <div className="flex flex-col h-screen overflow-hidden w-full">
        <AppHeader title={title} showSearch={showSearch}>
          {headerActions}
        </AppHeader>
        
        <main className="flex-1 overflow-y-auto relative scroll-smooth flex flex-col">
          <div className="p-6 max-w-7xl mx-auto w-full space-y-5 pb-20 flex-1 flex flex-col">
            {children}
          </div>
        </main>
        
        <AppFooter />
      </div>
    </div>
  )
}