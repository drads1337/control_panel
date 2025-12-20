import React from 'react'
import { SearchBar } from '@/components/ui/search-bar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { SidebarTrigger } from '@/components/animate-ui/components/radix/sidebar'
import { Separator } from '@/components/ui/separator'
import { useAuthContext } from '@/app/providers/auth-provider'
import { isAdmin, isOwner } from '@/lib/rbac'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'

interface AppHeaderProps {
  title: string
  children?: React.ReactNode
  showSearch?: boolean
}

export function AppHeader({ title, children, showSearch = true }: AppHeaderProps) {
  const { user } = useAuthContext()
  const showBalance = user && !isAdmin(user) && !isOwner(user)

  return (
    <header className="sticky top-0 z-10 bg-background-light dark:bg-background-dark/95 backdrop-blur-sm border-b border-border-light dark:border-border-dark h-14 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="lg:hidden text-inactive-dark hover:text-text-primary-dark" />
        <div className="flex items-center gap-2">
          <Icon name="space_dashboard" className="text-text-secondary-dark text-lg" />
          <h1 className="text-lg font-semibold text-gray-800 dark:text-text-primary-dark tracking-wide font-display">
            {title}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {showSearch && (
          <div className="relative hidden sm:block group">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Icon name="search" className="text-text-secondary-dark text-base group-focus-within:text-primary transition-colors" />
            </span>
            <input 
              className="pl-9 pr-10 py-1 bg-surface-dark border border-border-dark rounded text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary w-64 placeholder-text-secondary-dark transition-all outline-none" 
              placeholder="Search system..." 
              type="text" 
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
              <span className="text-[10px] text-text-secondary-dark border border-border-dark rounded px-1.5 py-0.5 font-mono-numbers">⌘K</span>
            </div>
          </div>
        )}
        {showBalance && (
          <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium">
            <span className="text-muted-foreground">Balance:</span>
            <span className="font-semibold">{user.token_balance ?? 0} tokens</span>
          </Badge>
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