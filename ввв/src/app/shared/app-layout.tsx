import React from 'react'
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
    <div className="flex flex-col h-screen overflow-hidden">
      <AppHeader title={title} showSearch={showSearch}>
        {headerActions}
      </AppHeader>
      
      {/* АДАПТАЦИЯ: 
          px-4 pt-4: Уменьшенные отступы для мобильных (16px)
          sm:px-6 sm:pt-6: Оригинальные отступы для планшетов и ПК (24px)
      */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 sm:px-6 sm:pt-6">
        {/* АДАПТАЦИЯ: Отступ снизу тоже уменьшен на мобильном */}
        <div className="pb-4 sm:pb-6">
          {children}
        </div>
      </main>
      
      <AppFooter />
    </div>
  )
}