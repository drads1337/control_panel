import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
import { useIsMobile } from '@/hooks/use-mobile'
import { getProject } from '@/entities/project'
import { projectKeys } from '@/hooks/use-projects-query'
import { useNavigationQuery } from '@/hooks/use-navigation-query'
import { canAccessNavigationItem, type NavigationItem } from '@/entities/navigation'
import { getAvatarUrl } from '@/lib/utils'
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

function AppSidebarContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isInitialized } = useAuthContext()
  const { state } = useAnimateSidebar()
  const isMobile = useIsMobile()

  const { navigation: navigationConfig } = useNavigationQuery({
    enabled: isInitialized && !!user,
    staleTime: 5 * 60 * 1000,
  })

  const userRole = user?.roles?.[0]

  const allSidebarItems = navigationConfig?.navigation
    ? convertNavigationItemsToSidebarItems(navigationConfig.navigation)
    : []

  const sidebarItems = allSidebarItems.filter(item => canAccessNavigationItem(item, user, userRole))

  const { data: currentProject } = useQuery({
    queryKey: projectKeys.detail(String(user?.project_id)),
    queryFn: () => getProject(user!.project_id!),
    enabled: !!user?.project_id && isInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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

  const handleNavigation = (href: string) => {
    navigate(href)
  }

  const isCollapsed = state === 'collapsed'

  return (
    <>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-default"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Briefcase className="size-4" />
              </div>
              {!isCollapsed && (
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {currentProject?.name || 'Panel'}
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
              {sidebarItems.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      onClick={() => handleNavigation(item.href)}
                      isActive={isActive}
                      tooltip={isCollapsed ? item.title : undefined}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                      {item.badge && (
                        <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
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
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-foreground">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="grid flex-1 text-left text-sm leading-tight">
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
                  {!isCollapsed && <ChevronsUpDown className="ml-auto size-4" />}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg ml-2"
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
    <Sidebar collapsible="icon" variant="sidebar">
      <AppSidebarContent />
    </Sidebar>
  )
}

export default function AppSidebar() {
  return <AppSidebarInner />
}