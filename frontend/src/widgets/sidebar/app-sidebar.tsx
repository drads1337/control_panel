"use client"

import * as React from "react"
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LogOut,
  Settings,
  User,
} from 'lucide-react'
import { NotificationList } from '@/components/animate-ui/components/community/notification-list'
import { getUserNotifications, incrementNotificationShowCount } from '@/entities/notification'
import { useAuthContext } from '@/app/providers/auth-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/lib/hooks'
import { getProject, projectKeys } from '@/entities/project'
import { useNavigationQuery, canAccessNavigationItem, type NavigationItem } from '@/entities/navigation'
import { getAvatarUrl, cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'

interface SidebarItem extends Omit<NavigationItem, 'icon'> {
  title: string
  icon: string
  badge?: string
  items?: Array<{ title: string; url: string }>
}

const navigationUIMap: Record<string, { title: string; icon: string }> = {
  '/owner-dashboard': {
    title: 'Dashboard',
    icon: 'space_dashboard'
  },
  '/dashboard': {
    title: 'Dashboard',
    icon: 'space_dashboard'
  },
  '/projects': {
    title: 'Projects',
    icon: 'work'
  },
  '/servers': {
    title: 'Servers',
    icon: 'database'
  },
  '/management-page': {
    title: 'Management',
    icon: 'vpn_key'
  },
  '/users-management': {
    title: 'Users',
    icon: 'people'
  },
  '/remote-control': {
    title: 'Remote Control',
    icon: 'terminal'
  },
  '/security': {
    title: 'Security',
    icon: 'security'
  },
  '/webhooks': {
    title: 'Webhooks',
    icon: 'webhook'
  },
  '/logs': {
    title: 'Logs',
    icon: 'description'
  }
}

const convertNavigationItemsToSidebarItems = (navigationItems: NavigationItem[]): SidebarItem[] =>
  navigationItems
    .map(item => {
      const uiMetadata = navigationUIMap[item.href]
      return uiMetadata ? { ...item, title: uiMetadata.title, icon: uiMetadata.icon, items: [] } as SidebarItem : null
    })
    .filter((item): item is SidebarItem => item !== null)

interface NavItemProps {
  icon: string
  label: string
  active?: boolean
  onClick?: () => void
  href?: string
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active = false, onClick, href }) => {
  const buttonContent = (
    <>
      <Icon name={icon} className={cn("text-[18px] transition-colors", active ? "" : "group-hover:text-primary")} />
      {label}
    </>
  )

  const className = cn(
    "w-full flex items-center gap-3 px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 group text-left",
    active
      ? "bg-white/5 border border-border-dark text-primary dark:text-text-primary-dark shadow-glow"
      : "text-gray-600 dark:text-text-secondary-dark hover:bg-white/5 hover:text-primary border border-transparent"
  )

  if (href) {
    return (
      <Link to={href} onClick={onClick} className={className}>
        {buttonContent}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={className}>
      {buttonContent}
    </button>
  )
}

interface TeamSwitcherProps {
  projectName: string
  isLoading: boolean
  activeTeam?: {
    name: string
    logo: React.ElementType
    plan: string
  }
}

function TeamSwitcher({ projectName, isLoading, activeTeam }: TeamSwitcherProps) {
  const isMobile = useIsMobile()
  const displayName = isLoading ? 'Loading...' : projectName
  const team = activeTeam || {
    name: displayName,
    plan: "Enterprise"
  }

  // Get initials from project name
  const initials = displayName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'YM'

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center text-background-dark font-bold text-xs font-display">
          {initials}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold dark:text-text-primary-dark tracking-wide font-display">{displayName}</span>
          <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-mono">{team.plan}</span>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Icon name="unfold_more" className="text-text-secondary-dark text-xs cursor-pointer" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-surface-dark border-border-dark"
          align="start"
          side={isMobile ? "bottom" : "right"}
          sideOffset={4}
        >
          <DropdownMenuLabel className="text-xs text-text-secondary-dark">
            Teams
          </DropdownMenuLabel>
          <DropdownMenuItem className="gap-2 p-2">
            <div className="flex size-6 items-center justify-center rounded-sm bg-primary text-background-dark font-bold text-xs">
              {initials}
            </div>
            {displayName}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}


interface NavMainProps {
  items: SidebarItem[]
  location: ReturnType<typeof useLocation>
  onNavigate: (href: string) => void
}

function NavMain({ items, location, onNavigate }: NavMainProps) {
  return (
    <nav className="mt-3 px-2 space-y-0.5 font-display">
      <p className="px-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest mb-2 mt-2 opacity-60">Platform</p>
      {items.map((item) => {
        const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
        return (
          <NavItem
            key={item.title}
            icon={item.icon}
            label={item.title}
            active={isActive}
            href={item.href}
            onClick={() => onNavigate(item.href)}
          />
        )
      })}
    </nav>
  )
}

interface NavUserProps {
  user: any
  onNavigate: (href: string) => void
  onLogout: () => void
  notifications: any[]
  showNotifications: boolean
  onNotificationClick: (notificationId: number) => void
}

function NavUser({
  user,
  onNavigate,
  onLogout,
  notifications,
  showNotifications,
  onNotificationClick,
}: NavUserProps) {
  const isMobile = useIsMobile()
  const userRole = user?.roles?.[0]
  const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User'
  const displayName = user?.username || 'User'

  const userInitials = displayName.charAt(0).toUpperCase()

  return (
    <>
      {showNotifications && notifications.length > 0 && (
        <div className="mb-2 px-2">
          <NotificationList
            notifications={notifications}
            limit={3}
            onNotificationClick={onNotificationClick}
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-border-dark flex items-center justify-center text-text-secondary-dark font-bold text-xs font-display">
          {userInitials}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold dark:text-text-primary-dark font-display">{displayName}</span>
          <span className="text-[10px] text-text-secondary-dark">{roleLabel}</span>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Icon name="unfold_more" className="text-text-secondary-dark text-xs cursor-pointer" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          side={isMobile ? 'bottom' : 'right'}
          align="end"
          sideOffset={4}
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={getAvatarUrl(user?.avatar)} alt={user?.username || 'User'} />
                <AvatarFallback className="rounded-lg">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user?.username || 'User'}</span>
                <span className="truncate text-xs">{roleLabel}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onNavigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            {canAccessNavigationItem(
              { href: '/settings', permission: 'project.view' },
              user,
              userRole
            ) && (
              <DropdownMenuItem onClick={() => onNavigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export default function AppSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isInitialized } = useAuthContext()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()

  const { navigation: navigationConfig } = useNavigationQuery({
    enabled: isInitialized && !!user,
  })

  const sidebarItems = React.useMemo(() => {
    if (!navigationConfig?.navigation || !user) return []
    
    // Filter navigation items based on user permissions
    const userRole = user?.roles?.[0]
    const accessibleItems = navigationConfig.navigation.filter(item => 
      canAccessNavigationItem(item, user, userRole)
    )
    
    return convertNavigationItemsToSidebarItems(accessibleItems)
  }, [navigationConfig?.navigation, user])

  const { data: currentProjectResponse, isLoading: isProjectLoading } = useQuery({
    queryKey: projectKeys.detail(String(user?.project_id)),
    queryFn: () => getProject(user!.project_id!),
    enabled: !!user?.project_id && isInitialized,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status
      return status !== 401 && status !== 403 && status !== 404 && failureCount < 2
    },
  })

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', 'sidebar', user?.id],
    queryFn: () => getUserNotifications({ page: 1, per_page: 10, unread_only: true }),
    enabled: isInitialized && !!user,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  })

  const notifications = React.useMemo(() => {
    return (notificationsData?.notifications || []).filter(notification => {
      const message = notification.message || ''
      if (message.trim().startsWith('[')) return false
      if (notification.show_count !== undefined && notification.show_count >= 1) return false
      if (notification.is_read === true) return false
      return true
    })
  }, [notificationsData?.notifications])

  const [showNotifications, setShowNotifications] = React.useState(true)

  const handleNavigation = React.useCallback((href: string) => navigate(href), [navigate])
  const handleLogout = React.useCallback(() => logout(), [logout])

  const handleNotificationClick = React.useCallback(async (notificationId: number) => {
    try {
      await incrementNotificationShowCount(notificationId)
      queryClient.invalidateQueries({ queryKey: ['notifications', 'sidebar', user?.id] })
    } catch (error) {
      console.error('Failed to mark notification as viewed:', error)
    }
  }, [queryClient, user?.id])

  const projectName = React.useMemo(() => {
    const projectResponse = currentProjectResponse as any
    const projectData = projectResponse?.data || projectResponse
    return projectData?.name || 'No project'
  }, [currentProjectResponse])

  return (
    <aside className="w-60 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark flex flex-col justify-between flex-shrink-0 z-20 h-full">
      <div>
        {/* Organization Header */}
        <div className="p-3 border-b border-border-light dark:border-border-dark flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
          <TeamSwitcher
            projectName={projectName}
            isLoading={isProjectLoading}
          />
        </div>

        {/* Navigation */}
        <NavMain
          items={sidebarItems}
          location={location}
          onNavigate={handleNavigation}
        />
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-border-light dark:border-border-dark flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
        <NavUser
          user={user}
          onNavigate={handleNavigation}
          onLogout={handleLogout}
          notifications={notifications}
          showNotifications={showNotifications}
          onNotificationClick={handleNotificationClick}
        />
      </div>
    </aside>
  )
}

export const AppSidebarInner = AppSidebar
