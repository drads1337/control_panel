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
  GalleryVerticalEnd,
  Plus,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useIsMobile } from '@/lib/hooks'
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
  activeTeam?: {
    name: string
    logo: React.ElementType
    plan: string
  }
}

function TeamSwitcher({ projectName, isLoading, activeTeam }: TeamSwitcherProps) {
  const isMobile = useIsMobile()
  const displayName = isLoading ? 'Loading...' : projectName
  // Create a default "team" object if activeTeam is not provided
  const team = activeTeam || {
    name: displayName,
    logo: GalleryVerticalEnd,
    plan: "Enterprise" // Default plan or fetch from somewhere if available
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <team.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{displayName}</span>
                <span className="truncate text-xs">{team.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
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
            {/* 
                Here we could list other teams if we had them. 
                For now we just show the current one as the "active" one in the dropdown list too 
                to emulate the look, or just keeping the trigger is enough if we don't have others.
                But usually Shadcn example has a list here. 
            */}
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-sm border">
                <team.logo className="size-4 shrink-0" />
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
      </SidebarMenuItem>
    </SidebarMenu>
  )
}


interface NavMainProps {
  items: SidebarItem[]
  location: ReturnType<typeof useLocation>
  onNavigate: (href: string) => void
}

function NavMain({ items, location, onNavigate }: NavMainProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
            const IconComponent = navigationUIMap[item.href]?.icon
          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} isActive={isActive} asChild={!item.items?.length}>
                    {item.items && item.items.length > 0 ? (
                        <>
                            {IconComponent && <IconComponent />}
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </>
                    ) : (
                        <Link to={item.href}>
                            {IconComponent && <IconComponent />}
                            <span>{item.title}</span>
                        </Link>
                    )}
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                {item.items && item.items.length > 0 && (
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

  return (
    <>
      {showNotifications && notifications.length > 0 && (
        <div className="mb-2 px-2">
            {/* Wrapped in div for spacing, though original was direct. 
                NotificationList expects container context? 
                It was originally just <div className="mb-2"><NotificationList.../></div> 
            */}
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
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user?.username || 'User'}</span>
                  <span className="truncate text-xs">{roleLabel}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
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
        />
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={sidebarItems}
          location={location}
          onNavigate={handleNavigation}
        />
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          user={user}
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
