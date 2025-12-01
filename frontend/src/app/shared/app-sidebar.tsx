import React, { useMemo, useCallback, useState, useEffect } from 'react'
import { useNavigate, useLocation, type Location } from 'react-router-dom'
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
} from 'lucide-react'
import { NotificationList } from '@/components/animate-ui/components/community/notification-list'
import { getUserNotifications, incrementNotificationShowCount } from '@/entities/notification'
import { useAuthContext } from '@/contexts/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { getProject, projectKeys } from '@/entities/project'
import { useNavigationQuery, canAccessNavigationItem, type NavigationItem } from '@/entities/navigation'
import { getAvatarUrl, cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarRail,
  useSidebar as useAnimateSidebar,
} from '@/components/animate-ui/components/radix/sidebar'

interface SidebarItem extends NavigationItem {
  title: string
  icon: React.ReactNode
  badge?: string
}

const navigationUIMap: Record<string, { title: string; icon: React.ReactNode }> = {
  '/owner-dashboard': {
    title: 'Dashboard',
    icon: <LayoutDashboard />
  },
  '/dashboard': {
    title: 'Dashboard',
    icon: <LayoutDashboard />
  },
  '/projects': {
    title: 'Projects',
    icon: <Briefcase />
  },
  '/servers': {
    title: 'Servers',
    icon: <Database />
  },
  '/management-page': {
    title: 'Management',
    icon: <KeyRound />
  },
  '/users-management': {
    title: 'Users',
    icon: <Users />
  },
  '/remote-control': {
    title: 'Remote Control',
    icon: <Terminal />
  },
  '/security': {
    title: 'Security',
    icon: <Shield />
  },
  '/webhooks': {
    title: 'Webhooks',
    icon: <Webhook />
  },
  '/logs': {
    title: 'Logs',
    icon: <ScrollText />
  }
}

const convertNavigationItemsToSidebarItems = (navigationItems: NavigationItem[]): SidebarItem[] =>
  navigationItems
    .map(item => {
      const uiMetadata = navigationUIMap[item.href]
      return uiMetadata ? { ...item, title: uiMetadata.title, icon: uiMetadata.icon } as SidebarItem : null
    })
    .filter((item): item is SidebarItem => item !== null)

interface AppSidebarNavigationItemProps {
  item: SidebarItem;
  isCollapsed: boolean;
  location: Location;
  onNavigate: (href: string) => void;
}

const AppSidebarNavigationItem = React.memo<AppSidebarNavigationItemProps>(({
  item,
  isCollapsed,
  location,
  onNavigate,
}) => {
  const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => onNavigate(item.href)}
        isActive={isActive}
        tooltip={isCollapsed ? item.title : undefined}
      >
        {item.icon}
        <span>{item.title}</span>
        {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
})
AppSidebarNavigationItem.displayName = 'AppSidebarNavigationItem'

function AppSidebarContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isInitialized } = useAuthContext()
  const { state } = useAnimateSidebar()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const isCollapsed = state === 'collapsed'

  const { navigation: navigationConfig } = useNavigationQuery({
    enabled: isInitialized && !!user,
  })

  const sidebarItems = useMemo(() => {
    if (!navigationConfig?.navigation) return []
    return convertNavigationItemsToSidebarItems(navigationConfig.navigation)
  }, [navigationConfig?.navigation])

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

  const notifications = useMemo(() => {
    return (notificationsData?.notifications || []).filter(notification => {
      const message = notification.message || ''
      if (message.trim().startsWith('[')) return false
      if (notification.show_count !== undefined && notification.show_count >= 1) return false
      if (notification.is_read === true) return false
      return true
    })
  }, [notificationsData?.notifications])

  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (!isCollapsed) {
      const timer = setTimeout(() => setShowNotifications(true), 300)
      return () => clearTimeout(timer)
    } else {
      setShowNotifications(false)
    }
  }, [isCollapsed])

  const handleNavigation = useCallback((href: string) => navigate(href), [navigate])
  const handleLogout = () => logout()

  const handleNotificationClick = useCallback(async (notificationId: number) => {
    try {
      await incrementNotificationShowCount(notificationId)
      queryClient.invalidateQueries({ queryKey: ['notifications', 'sidebar', user?.id] })
    } catch (error) {
      console.error('Failed to mark notification as viewed:', error)
    }
  }, [queryClient, user?.id])

  const projectName = useMemo(() => {
    if (isProjectLoading) return 'Loading...'
    const projectResponse = currentProjectResponse as any
    const projectData = projectResponse?.data || projectResponse
    return projectData?.name || 'No project'
  }, [currentProjectResponse, isProjectLoading])

  const userRole = user?.roles?.[0]
  const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User'

  return (
    <>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-default"
              tooltip={isCollapsed ? projectName : undefined}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
                <Briefcase className="size-4" />
              </div>
              {!isCollapsed && (
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-semibold">{projectName}</span>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) => (
                <AppSidebarNavigationItem
                  key={item.href}
                  item={item}
                  isCollapsed={isCollapsed}
                  location={location}
                  onNavigate={handleNavigation}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {showNotifications && notifications.length > 0 && (
          <div className="mb-2">
            <NotificationList
              notifications={notifications}
              limit={3}
              onNotificationClick={handleNotificationClick}
            />
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg shrink-0">
                    <AvatarImage src={getAvatarUrl(user?.avatar)} alt={user?.username || 'User'} />
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-foreground">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                      <span className="truncate font-semibold">{user?.username || 'User'}</span>
                      <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
                    </div>
                  )}
                  {!isCollapsed && <ChevronsUpDown className="ml-auto size-4 shrink-0" />}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className={cn("w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg", !isMobile && "ml-2")}
                side={isMobile ? 'top' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg shrink-0">
                      <AvatarImage src={getAvatarUrl(user?.avatar)} alt={user?.username || 'User'} />
                      <AvatarFallback className="rounded-lg">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                      <span className="truncate font-semibold">{user?.username || 'User'}</span>
                      <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </>
  )
}

export default function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <AppSidebarContent />
    </Sidebar>
  )
}

export const AppSidebarInner = AppSidebar