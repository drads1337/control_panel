"use client"

import * as React from "react"
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
  ChevronRight,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/animate-ui/primitives/radix/collapsible'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { getProject, projectKeys } from '@/entities/project'
import { useNavigationQuery, canAccessNavigationItem, type NavigationItem } from '@/entities/navigation'
import { getAvatarUrl, cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  useSidebar,
} from '@/components/animate-ui/components/radix/sidebar'

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

interface TeamSwitcherProps {
  projectName: string
  isLoading: boolean
  isCollapsed: boolean
  isMobile: boolean
}

function TeamSwitcher({ projectName, isLoading, isCollapsed, isMobile }: TeamSwitcherProps) {
  const displayName = isLoading ? 'Loading...' : projectName

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-default"
          tooltip={isCollapsed ? displayName : undefined}
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Briefcase className="size-4" />
          </div>
          {!isCollapsed && (
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{displayName}</span>
            </div>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

interface NavMainProps {
  items: SidebarItem[]
  location: ReturnType<typeof useLocation>
  isCollapsed: boolean
  onNavigate: (href: string) => void
}

function NavMain({ items, location, isCollapsed, onNavigate }: NavMainProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Main</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
          const IconComponent = navigationUIMap[item.href]?.icon
          
          return (
            <Collapsible
              key={item.href}
              asChild
              defaultOpen={isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                {item.items && item.items.length > 0 ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={isCollapsed ? item.title : undefined} isActive={isActive}>
                        {IconComponent && <IconComponent className="size-4" />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild>
                              <Link to={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : (
                  <SidebarMenuButton asChild tooltip={isCollapsed ? item.title : undefined} isActive={isActive}>
                    <Link to={item.href}>
                      {IconComponent && <IconComponent className="size-4" />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

interface NavUserProps {
  user: any
  isCollapsed: boolean
  isMobile: boolean
  onNavigate: (href: string) => void
  onLogout: () => void
  notifications: any[]
  showNotifications: boolean
  onNotificationClick: (notificationId: number) => void
}

function NavUser({
  user,
  isCollapsed,
  isMobile,
  onNavigate,
  onLogout,
  notifications,
  showNotifications,
  onNotificationClick,
}: NavUserProps) {
  const userRole = user?.roles?.[0]
  const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User'

  return (
    <>
      {showNotifications && notifications.length > 0 && (
        <div className="mb-2">
          <NotificationList
            notifications={notifications}
            limit={3}
            onNotificationClick={onNotificationClick}
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
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={getAvatarUrl(user?.avatar)} alt={user?.username || 'User'} />
                  <AvatarFallback className="rounded-lg">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.username || 'User'}</span>
                    <span className="truncate text-xs">{roleLabel}</span>
                  </div>
                )}
                {!isCollapsed && <ChevronsUpDown className="ml-auto size-4" />}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className={cn("w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg", !isMobile && "ml-2")}
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
              <DropdownMenuItem onClick={() => onNavigate('/profile')}>
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              {canAccessNavigationItem(
                { href: '/settings', permission: 'project.view' },
                user,
                userRole
              ) && (
                <DropdownMenuItem onClick={() => onNavigate('/settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}

function AppSidebarContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isInitialized } = useAuthContext()
  const { state } = useSidebar()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const isCollapsed = state === 'collapsed'

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

  const [showNotifications, setShowNotifications] = React.useState(false)

  React.useEffect(() => {
    if (!isCollapsed) {
      const timer = setTimeout(() => setShowNotifications(true), 300)
      return () => clearTimeout(timer)
    } else {
      setShowNotifications(false)
    }
  }, [isCollapsed])

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
    <>
      <SidebarHeader>
        <TeamSwitcher
          projectName={projectName}
          isLoading={isProjectLoading}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
        />
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={sidebarItems}
          location={location}
          isCollapsed={isCollapsed}
          onNavigate={handleNavigation}
        />
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          user={user}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          onNavigate={handleNavigation}
          onLogout={handleLogout}
          notifications={notifications}
          showNotifications={showNotifications}
          onNotificationClick={handleNotificationClick}
        />
      </SidebarFooter>

      <SidebarRail />
    </>
  )
}

export default function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <AppSidebarContent />
    </Sidebar>
  )
}

export const AppSidebarInner = AppSidebar
