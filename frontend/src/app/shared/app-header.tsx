import React from 'react'
import { SearchBar } from '@/components/ui/search-bar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { SidebarTrigger } from '@/components/animate-ui/components/radix/sidebar'
import { Separator } from '@/components/ui/separator'

interface AppHeaderProps {
  title: string
  children?: React.ReactNode
  showSearch?: boolean
}

export function AppHeader({ title, children, showSearch = true }: AppHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </div>

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
    </header>
  )
}