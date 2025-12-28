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
  Menu,
  Bell,
} from 'lucide-react'
import { SearchBar } from '@/components/ui/search-bar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Separator } from '@/components/ui/separator'
import { useAuthContext } from '@/contexts/auth-context'
import { isAdmin, isOwner } from '@/lib/rbac-utils'
import { Badge } from '@/components/ui/badge'
import { NotificationList } from '@/components/animate-ui/components/community/notification-list'
import { getUserNotifications, incrementNotificationShowCount } from '@/entities/notification'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from '@/components/ui/navigation-menu'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { getProject, projectKeys } from '@/entities/project'
import { useNavigationQuery, canAccessNavigationItem, type NavigationItem } from '@/entities/navigation'
import { getAvatarUrl, cn } from '@/lib/utils'

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

export function AppHeader({ title, children, showSearch = true }: AppHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isInitialized } = useAuthContext()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

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

  const handleNavigation = React.useCallback((href: string) => {
    navigate(href)
    setMobileMenuOpen(false)
  }, [navigate])

  const handleLogout = React.useCallback(() => {
    logout()
    setMobileMenuOpen(false)
  }, [logout])

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

  const showBalance = user && !isAdmin(user) && !isOwner(user)
  const userRole = user?.roles?.[0]
  const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User'

  const NavigationItems = () => (
    <>
      {sidebarItems.map((item) => {
        const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
        
        return (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink asChild>
              <Button
                variant="ghost"
                asChild
                size="sm"
                className="px-2.5"
              >
                <Link
                  to={item.href}
                  data-active={isActive}
                  className="relative items-center"
                >
                  {item.title}
                </Link>
              </Button>
            </NavigationMenuLink>
          </NavigationMenuItem>
        )
      })}
    </>
  )

  return (
    <header className="bg-background sticky top-0 z-50 w-full border-b">
      <div className="container-wrapper px-6">
        <div className="flex h-(--header-height) items-center **:data-[slot=separator]:!h-4">
          {/* Mobile menu button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col gap-4 mt-4">
                {/* Project Switcher */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Briefcase className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{isProjectLoading ? 'Loading...' : projectName}</div>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex flex-col gap-1">
                  {sidebarItems.map((item) => {
                    const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
                    const IconComponent = item.icon
                    
                    return (
                      <Button
                        key={item.href}
                        variant={isActive ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => handleNavigation(item.href)}
                      >
                        {IconComponent && <IconComponent className="mr-2 h-4 w-4" />}
                        {item.title}
                      </Button>
                    )
                  })}
                </nav>

                {/* Notifications */}
                {notifications.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold mb-2">Notifications</div>
                    <NotificationList
                      notifications={notifications}
                      limit={5}
                      onNotificationClick={handleNotificationClick}
                    />
                  </div>
                )}

                {/* User Menu */}
                <div className="mt-auto pt-4 border-t">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start">
                        <Avatar className="h-8 w-8 rounded-lg mr-2">
                          <AvatarImage src={getAvatarUrl(user?.avatar)} alt={user?.username || 'User'} />
                          <AvatarFallback className="rounded-lg">
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-semibold">{user?.username || 'User'}</div>
                          <div className="text-xs text-muted-foreground">{roleLabel}</div>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarImage src={getAvatarUrl(user?.avatar)} alt={user?.username || 'User'} />
                            <AvatarFallback className="rounded-lg">
                              {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold">{user?.username || 'User'}</div>
                            <div className="text-xs text-muted-foreground">{roleLabel}</div>
                          </div>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleNavigation('/profile')}>
                        <User className="h-4 w-4 mr-2" />
                        Profile
                      </DropdownMenuItem>
                      {canAccessNavigationItem(
                        { href: '/settings', permission: 'project.view' },
                        user,
                        userRole
                      ) && (
                        <DropdownMenuItem onClick={() => handleNavigation('/settings')}>
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Log out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Project Switcher - Desktop */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="hidden md:flex items-center gap-2 h-8 px-2.5">
                <div className="flex aspect-square size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Briefcase className="size-3.5" />
                </div>
                <span className="font-semibold text-sm max-w-[120px] truncate">
                  {isProjectLoading ? 'Loading...' : projectName}
                </span>
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>
                <div className="flex items-center gap-2">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Briefcase className="size-4" />
                  </div>
                  <div>
                    <div className="font-semibold">{isProjectLoading ? 'Loading...' : projectName}</div>
                    <div className="text-xs text-muted-foreground">Current Project</div>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="ml-2 hidden md:block" />

          {/* Navigation - Desktop */}
          <NavigationMenu className="hidden md:flex flex-1 max-w-2xl">
            <NavigationMenuList className="gap-0.5">
              <NavigationItems />
            </NavigationMenuList>
          </NavigationMenu>

          {/* Title - Mobile only */}
          <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate md:hidden flex-1 ml-2">
            {title}
          </h1>

          <div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
            {/* Search */}
            {showSearch && (
              <div className="hidden w-full flex-1 md:flex md:w-auto md:flex-none">
                <SearchBar placeholder="Search the system..." />
              </div>
            )}

            {/* Balance */}
            {showBalance && (
              <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium">
                <span className="text-muted-foreground">Balance:</span>
                <span className="font-semibold">{user.token_balance ?? 0} tokens</span>
              </Badge>
            )}

            {/* Notifications - Desktop */}
            {notifications.length > 0 && (
              <>
                <Separator orientation="vertical" className="ml-2 hidden lg:block" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="hidden md:flex relative h-8 w-8">
                      <Bell className="h-4 w-4" />
                      <div className="absolute top-0.5 right-0.5 h-2 w-2 bg-red-500 rounded-full border border-background" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="max-h-[400px] overflow-y-auto">
                      <NotificationList
                        notifications={notifications}
                        limit={10}
                        onNotificationClick={handleNotificationClick}
                      />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {/* User Menu - Desktop */}
            <Separator orientation="vertical" className="hidden lg:block" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hidden md:flex items-center gap-2 h-8 px-2">
                  <Avatar className="h-7 w-7 rounded-lg">
                    <AvatarImage src={getAvatarUrl(user?.avatar)} alt={user?.username || 'User'} />
                    <AvatarFallback className="rounded-lg">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium max-w-[100px] truncate hidden lg:inline">
                    {user?.username || 'User'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={getAvatarUrl(user?.avatar)} alt={user?.username || 'User'} />
                      <AvatarFallback className="rounded-lg">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">{user?.username || 'User'}</div>
                      <div className="text-xs text-muted-foreground">{roleLabel}</div>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigation('/profile')}>
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                {canAccessNavigationItem(
                  { href: '/settings', permission: 'project.view' },
                  user,
                  userRole
                ) && (
                  <DropdownMenuItem onClick={() => handleNavigation('/settings')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" />
            <ThemeToggle />
            <Separator orientation="vertical" className="mr-2" />

            {children && (
              <div className="flex items-center gap-2">
                {children}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}