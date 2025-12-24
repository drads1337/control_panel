import React from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Briefcase,
  Database,
  KeyRound,
  Users,
  Terminal,
  Shield,
  Webhook,
  ScrollText,
  LogOut,
  Settings,
  User,
  ChevronsUpDown,
  ChevronDown,
  GalleryVerticalEnd,
  Plus,
  Menu,
  Bell,
  Search,
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
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { SearchBar } from '@/components/ui/search-bar'
import { useIsMobile } from '@/lib/hooks'
import { getProject, projectKeys } from '@/entities/project'
import { useNavigationQuery, canAccessNavigationItem, type NavigationItem } from '@/entities/navigation'
import { getAvatarUrl, cn } from '@/lib/utils'
import { isAdmin, isOwner } from '@/lib/rbac'

interface AppHeaderProps {
  title: string
  children?: React.ReactNode
  showSearch?: boolean
}

interface SidebarItem extends Omit<NavigationItem, 'icon'> {
  title: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  items?: Array<{ title: string; url: string }>
}

const navigationUIMap: Record<string, { title: string; icon: React.ComponentType<{ className?: string }> }> = {
  '/owner-dashboard': {
    title: 'Dashboard',
    icon: LayoutDashboard
  },
  '/dashboard': {
    title: 'Dashboard',
    icon: LayoutDashboard
  },
  '/projects': {
    title: 'Projects',
    icon: Briefcase
  },
  '/servers': {
    title: 'Servers',
    icon: Database
  },
  '/management-page': {
    title: 'Management',
    icon: KeyRound
  },
  '/users-management': {
    title: 'Users',
    icon: Users
  },
  '/remote-control': {
    title: 'Remote Control',
    icon: Terminal
  },
  '/security': {
    title: 'Security',
    icon: Shield
  },
  '/webhooks': {
    title: 'Webhooks',
    icon: Webhook
  },
  '/logs': {
    title: 'Logs',
    icon: ScrollText
  }
}

const convertNavigationItemsToSidebarItems = (navigationItems: NavigationItem[]): SidebarItem[] =>
  navigationItems
    .map(item => {
      const uiMetadata = navigationUIMap[item.href]
      return uiMetadata ? { ...item, title: uiMetadata.title, icon: uiMetadata.icon, items: [] } as SidebarItem : null
    })
    .filter((item): item is SidebarItem => item !== null)

function ProjectSwitcher({ projectName, isLoading }: { projectName: string; isLoading: boolean }) {
  const isMobile = useIsMobile()
  const displayName = isLoading ? 'Loading...' : projectName

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2 sm:px-3">
          <div className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-3.5" />
          </div>
          <div className="hidden sm:grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">Enterprise</span>
          </div>
          <ChevronsUpDown className="hidden sm:block ml-auto size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        align="start"
        side={isMobile ? "bottom" : "right"}
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Teams
        </DropdownMenuLabel>
        <DropdownMenuItem className="gap-2 p-2">
          <div className="flex size-6 items-center justify-center rounded-sm border">
            <GalleryVerticalEnd className="size-4 shrink-0" />
          </div>
          {displayName}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 p-2">
          <div className="flex size-6 items-center justify-center rounded-md border bg-background">
            <Plus className="size-4" />
          </div>
          <div className="font-medium text-muted-foreground">Add team</div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavigationItems({ items, location, onNavigate }: { items: SidebarItem[]; location: ReturnType<typeof useLocation>; onNavigate: (href: string) => void }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Menu className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Navigation</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
            const IconComponent = item.icon
            
            return (
              <DropdownMenuItem
                key={item.href}
                onClick={() => onNavigate(item.href)}
                className={cn(isActive && "bg-accent")}
                asChild
              >
                <Link to={item.href} className="flex items-center gap-2">
                  {IconComponent && <IconComponent className="size-4" />}
                  <span>{item.title}</span>
                </Link>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <NavigationMenu>
      <NavigationMenuList>
        {items.map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
          const IconComponent = item.icon
          
          if (item.items && item.items.length > 0) {
            return (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuTrigger className={cn(isActive && "bg-accent")}>
                  {IconComponent && <IconComponent className="size-4" />}
                  <span>{item.title}</span>
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="p-2 w-48">
                    {item.items.map((subItem) => (
                      <NavigationMenuLink
                        key={subItem.title}
                        asChild
                        className="block rounded-sm px-3 py-2 text-sm hover:bg-accent"
                      >
                        <Link to={subItem.url}>
                          {subItem.title}
                        </Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            )
          }
          
          return (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuLink
                asChild
                className={cn(
                  "group inline-flex h-9 w-max items-center justify-center gap-2 rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent data-[state=open]:bg-accent",
                  isActive && "bg-accent"
                )}
              >
                <Link to={item.href}>
                  {IconComponent && <IconComponent className="size-4" />}
                  <span>{item.title}</span>
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

function UserMenu({
  user,
  onNavigate,
  onLogout,
  notifications,
  onNotificationClick,
}: {
  user: any
  onNavigate: (href: string) => void
  onLogout: () => void
  notifications: any[]
  onNotificationClick: (notificationId: number) => void
}) {
  const isMobile = useIsMobile()
  const userRole = user?.roles?.[0]
  const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User'
  const unreadCount = notifications.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2 sm:px-3 relative">
          <Avatar className="h-7 w-7 rounded-lg">
            <AvatarImage src={getAvatarUrl(user?.avatar)} alt={user?.username || 'User'} />
            <AvatarFallback className="rounded-lg">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{user?.username || 'User'}</span>
            <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <ChevronsUpDown className="hidden sm:block ml-auto size-4" />
        </Button>
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
              <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length > 0 && (
          <>
            <div className="px-2 py-1.5">
              <NotificationList
                notifications={notifications}
                limit={3}
                onNotificationClick={onNotificationClick}
              />
            </div>
            <DropdownMenuSeparator />
          </>
        )}
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
  )
}

export function AppHeader({ title, children, showSearch = true }: AppHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isInitialized } = useAuthContext()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const showBalance = user && !isAdmin(user) && !isOwner(user)

  const { navigation: navigationConfig } = useNavigationQuery({
    enabled: isInitialized && !!user,
  })

  const sidebarItems = React.useMemo(() => {
    if (!navigationConfig?.navigation || !user) return []
    
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
    queryKey: ['notifications', 'header', user?.id],
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

  const handleNavigation = React.useCallback((href: string) => navigate(href), [navigate])
  const handleLogout = React.useCallback(() => logout(), [logout])

  const handleNotificationClick = React.useCallback(async (notificationId: number) => {
    try {
      await incrementNotificationShowCount(notificationId)
      queryClient.invalidateQueries({ queryKey: ['notifications', 'header', user?.id] })
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
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b flex h-14 shrink-0 items-center gap-2 px-3 sm:px-6">
      {/* Left side: Project switcher and Navigation */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <ProjectSwitcher
          projectName={projectName}
          isLoading={isProjectLoading}
        />
        <Separator orientation="vertical" className="h-4 shrink-0" />
        <div className="hidden sm:block">
          <NavigationItems
            items={sidebarItems}
            location={location}
            onNavigate={handleNavigation}
          />
        </div>
        <Separator orientation="vertical" className="h-4 shrink-0 sm:hidden" />
        <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">
          {title}
        </h1>
      </div>

      {/* Right side: Search, Balance, Theme, User */}
      <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
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

        {user && (
          <UserMenu
            user={user}
            onNavigate={handleNavigation}
            onLogout={handleLogout}
            notifications={notifications}
            onNotificationClick={handleNotificationClick}
          />
        )}

        {children && (
          <div className="flex items-center gap-2">
            {children}
          </div>
        )}
      </div>
    </header>
  )
}
