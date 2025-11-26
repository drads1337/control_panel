import React from 'react'
import { SearchBar } from '@/components/ui/search-bar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { SidebarTrigger } from '@/components/animate-ui/components/radix/sidebar'
import { Separator } from '@/components/ui/separator'
import { useAuthContext } from '@/contexts/auth-context'
import { isAdmin, isOwner } from '@/lib/rbac-utils'
import { Badge } from '@/components/ui/badge'

interface AppHeaderProps {
  title: string
  children?: React.ReactNode
  showSearch?: boolean
}

export function AppHeader({ title, children, showSearch = true }: AppHeaderProps) {
  const { user } = useAuthContext()
  const showBalance = user && !isAdmin(user) && !isOwner(user)

  return (
    // АДАПТАЦИЯ: h-14 для мобильных, h-16 для планшетов+. px-3 для мобильных.
    <header className="flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-6 transition-all">
      {/* min-w-0 критичен для работы truncate внутри flex-контейнера */}
      <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-none">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4 shrink-0" />
        {/* АДАПТАЦИЯ: text-base для мобильных, truncate для обрезки длинных названий */}
        <h1 className="text-base sm:text-xl font-semibold tracking-tight truncate">
          {title}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Поиск скрыт на мобильных (hidden), появляется на md (планшет/ПК) */}
        {showSearch && (
          <div className="hidden md:block w-full max-w-sm">
            <SearchBar placeholder="Search the system..." />
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