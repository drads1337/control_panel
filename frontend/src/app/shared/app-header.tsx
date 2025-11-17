import React from 'react'
import { SearchBar } from '@/components/ui/search-bar'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface AppHeaderProps {
  title: string
  children?: React.ReactNode
  showSearch?: boolean
}

export function AppHeader({ title, children, showSearch = true }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <div className="flex w-full items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        
        <div className="ml-auto flex items-center gap-3">
          {showSearch && (
            <div className="max-w-sm">
              <SearchBar placeholder="Search the system..." />
            </div>
          )}
          
          <ThemeToggle />
          
          {children && (
            <div className="flex items-center gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}