import React, { useMemo, useCallback, useState, useEffect } from 'react'
import { useNavigate, useLocation, type Location } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
import { useQueryClient } from '@tanstack/react-query'
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
import { getProject } from '@/entities/project'
import { projectKeys } from '@/entities/project'
import { useNavigationQuery } from '@/entities/navigation'
import { canAccessNavigationItem, type NavigationItem } from '@/entities/navigation'
import { getAvatarUrl } from '@/lib/utils'
import { cn } from '@/lib/utils'
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
import type { User as UserType } from '@/entities/user';
import type { Project } from '@/entities/project';

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

function convertNavigationItemsToSidebarItems(navigationItems: NavigationItem[]): SidebarItem[] {
  return navigationItems
    .map(item => {
      const uiMetadata = navigationUIMap[item.href]
      if (!uiMetadata) {
        return null
      }

      return {
        ...item,
        title: uiMetadata.title,
        icon: uiMetadata.icon
      } as SidebarItem
    })
    .filter((item): item is SidebarItem => item !== null)
}

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
  const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);

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
  );
});
AppSidebarNavigationItem.displayName = 'AppSidebarNavigationItem';

function AppSidebarContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isInitialized } = useAuthContext()
  const { state } = useAnimateSidebar()
  const isMobile = useIsMobile()

  const { navigation: navigationConfig } = useNavigationQuery({
    enabled: isInitialized && !!user,
    // Use default staleTime from query defaults (15 minutes)
  })

  const userRole = user?.roles?.[0]

  // Memoize sidebar items to avoid recalculation on every render
  const sidebarItems = useMemo(() => {
    if (!navigationConfig?.navigation) {
      return []
    }
    const allSidebarItems = convertNavigationItemsToSidebarItems(navigationConfig.navigation)
    return allSidebarItems.filter(item => canAccessNavigationItem(item, user, userRole))
  }, [navigationConfig?.navigation, user, userRole])

  const { data: currentProjectResponse, isLoading: isProjectLoading, error: projectError } = useQuery({
    queryKey: projectKeys.detail(String(user?.project_id)),
    queryFn: async () => {
      return await getProject(user!.project_id!)
    },
    enabled: !!user?.project_id && isInitialized,
    staleTime: 10 * 60 * 1000, // 10 minutes - project data doesn't change often
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403 || error?.response?.status === 404) {
        return false
      }
      return failureCount < 2
    },
    meta: {
      errorMessage: null,
    },
  })

  const handleLogout = () => {
    logout()
  }

  const handleNavigation = useCallback((href: string) => {
    navigate(href)
  }, [navigate])

  const queryClient = useQueryClient()

  const handleNotificationClick = useCallback(async (notificationId: number) => {
    try {
      await incrementNotificationShowCount(notificationId)
      // Invalidate notifications query to refetch and update the list
      queryClient.invalidateQueries({ queryKey: ['notifications', 'sidebar', user?.id] })
    } catch (error) {
      console.error('Failed to mark notification as viewed:', error)
    }
  }, [queryClient, user?.id])

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', 'sidebar', user?.id],
    queryFn: () => getUserNotifications({ page: 1, per_page: 10, unread_only: true }),
    enabled: isInitialized && !!user,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    refetchOnWindowFocus: true,
  })

  // Filter to show only:
  // 1. "Send Notification" notifications (exclude product and agent notifications)
  // 2. Only notifications for current user (backend already filters)
  // 3. Only unread notifications (backend already filters with unread_only=true)
  // 4. Hide "Send Notification" type notifications after first show (show_count >= 1)
  const notifications = useMemo(() => {
    const allNotifications = notificationsData?.notifications || []
    
    return allNotifications.filter(notification => {
      const message = notification.message || ''
      // Exclude notifications that start with "[" (product/agent notifications)
      if (message.trim().startsWith('[')) {
        return false
      }
      
      // Hide "Send Notification" notifications after first show
      // If show_count >= 1, don't show it anymore (user already saw it once)
      if (notification.show_count !== undefined && notification.show_count >= 1) {
        return false
      }
      
      // Only show unread notifications (backend already filters, but extra safety check)
      if (notification.is_read === true) {
        return false
      }
      return true
    })
  }, [notificationsData?.notifications])

  // На мобильных устройствах состояние 'collapsed' обычно не используется так же, как на десктопе
  // (там сайдбар просто скрыт или открыт полностью), но проверка не помешает.
  const isCollapsed = state === 'collapsed'
  
  // Показываем уведомления только после полного раскрытия сайдбара
  const [showNotifications, setShowNotifications] = useState(false)
  
  useEffect(() => {
    if (!isCollapsed) {
      // Задержка для завершения анимации раскрытия сайдбара
      const timer = setTimeout(() => {
        setShowNotifications(true)
      }, 300) // 300ms - время анимации сайдбара
      return () => clearTimeout(timer)
    } else {
      // Сразу скрываем при сворачивании
      setShowNotifications(false)
    }
  }, [isCollapsed])

  return (
    <>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-default"
              tooltip={isCollapsed ? (currentProjectResponse as any)?.data?.name || (currentProjectResponse as any)?.name : undefined}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
                <Briefcase className="size-4" />
              </div>
              {!isCollapsed && (
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-semibold">
                    {(() => {
                      if (isProjectLoading) return 'Loading...'
                      if (projectError) return 'Error loading project'
                      // Handle cache wrapper response: { data: {...} } or direct project object
                      const projectResponse = currentProjectResponse as any
                      const projectData = projectResponse?.data || projectResponse
                      return projectData?.name || 'No project'
                    })()}
                  </span>
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
                      <span className="truncate font-semibold">
                        {user?.username || 'User'}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.roles && user.roles.length > 0 
                          ? user.roles[0].charAt(0).toUpperCase() + user.roles[0].slice(1) 
                          : 'User'
                        }
                      </span>
                    </div>
                  )}
                  {!isCollapsed && <ChevronsUpDown className="ml-auto size-4 shrink-0" />}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                // АДАПТАЦИЯ: Убираем ml-2 на мобильном, чтобы не вылезало за край
                className={cn(
                  "w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg",
                  !isMobile && "ml-2"
                )}
                // АДАПТАЦИЯ: На мобильном открываем ВВЕРХ (top), так как футер внизу экрана
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
                      <span className="truncate font-semibold">
                        {user?.username || 'User'}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.roles && user.roles.length > 0 
                          ? user.roles[0].charAt(0).toUpperCase() + user.roles[0].slice(1) 
                          : 'User'
                        }
                      </span>
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

export function AppSidebarInner() {
  return (
    // collapsible="icon" работает для десктопа. 
    // На мобильном SidebarProvider превращает это в Drawer (шторку).
    <Sidebar collapsible="icon" variant="sidebar">
      <AppSidebarContent />
    </Sidebar>
  )
}

export default function AppSidebar() {
  return <AppSidebarInner />
}