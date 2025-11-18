import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Menu,
  Settings,
  User,
  X
} from 'lucide-react'
import { useAuthContext } from '@/contexts/auth-context'
import { useSidebar } from '@/contexts/sidebar-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getProject } from '@/entities/project'
import { projectKeys } from '@/hooks/use-projects-query'
import { useNavigationQuery } from '@/hooks/use-navigation-query'
import { canAccessNavigationItem, type NavigationItem } from '@/entities/navigation'
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
    icon: <LayoutDashboard className="h-4 w-4" />
  },
  '/dashboard': {
    title: 'Dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />
  },
  '/projects': {
    title: 'Projects',
    icon: <Briefcase className="h-4 w-4" />
  },
  '/servers': {
    title: 'Servers',
    icon: <Database className="h-4 w-4" />
  },
  '/management-page': {
    title: 'Management',
    icon: <KeyRound className="h-4 w-4" />
  },
  '/users-management': {
    title: 'Users',
    icon: <Users className="h-4 w-4" />
  },
  '/remote-control': {
    title: 'Remote Control',
    icon: <Terminal className="h-4 w-4" />
  },
  '/security': {
    title: 'Security',
    icon: <Shield className="h-4 w-4" />
  },
  '/webhooks': {
    title: 'Webhooks',
    icon: <Webhook className="h-4 w-4" />
  },
  '/logs': {
    title: 'Logs',
    icon: <ScrollText className="h-4 w-4" />
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

export default function AppSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const navigate = useNavigate()
  const { user, logout, isInitialized } = useAuthContext()
  const { isCollapsed, toggleSidebar } = useSidebar()

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

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen)
  }

  const closeMobileSidebar = () => {
    setIsMobileOpen(false)
  }

  const handleNavigation = (href: string) => {

    navigate(href)
    closeMobileSidebar()
  }

  return (
    <>
      {}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {}
      <div className={`
        fixed left-0 top-0 z-40 h-full transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
        ${isCollapsed ? 'w-16' : 'w-64'}
        bg-sidebar border-r border-border
        dark:bg-sidebar dark:border-border
      `}>
        <div className="flex h-full flex-col">
          {}
          <div className="flex h-16 items-center justify-between px-4 border-b border-border dark:border-border">
            {!isCollapsed && (
              <h2 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground truncate">
                {currentProject?.name || 'Panel'}
              </h2>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="hidden lg:flex text-sidebar-foreground hover:bg-sidebar-accent"
            >
              {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeMobileSidebar}
              className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-2">
              {sidebarItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNavigation(item.href)}
                  className="w-full text-left flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <div className="flex-shrink-0">
                    {item.icon}
                  </div>
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{item.title}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </button>
              ))}
            </nav>
          </ScrollArea>

          {}
          <div className="p-3 border-t border-border dark:border-border">
            <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : 'flex-row'}`}>
              {}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`flex items-center gap-2 rounded-lg hover:bg-sidebar-accent transition-colors p-1.5 ${isCollapsed ? 'w-full justify-center' : 'flex-1 min-w-0'}`}>
                    <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarImage src={user?.avatar || undefined} />
                      <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                </Avatar>
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground truncate">
                    {user?.username || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
                    {user?.roles && user.roles.length > 0 
                      ? user.roles[0].charAt(0).toUpperCase() + user.roles[0].slice(1) 
                      : 'User'
                    }
                  </p>
                </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  side={isCollapsed ? "right" : "top"}
                  sideOffset={20}
                  alignOffset={0}
                  className={isCollapsed ? "w-40" : "w-60"}
                >
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.username || 'User'}</p>
                      <p className="text-xs text-muted-foreground">
                        {user?.roles && user.roles.length > 0 
                          ? user.roles[0].charAt(0).toUpperCase() + user.roles[0].slice(1) 
                          : 'User'
                        }
                      </p>
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
                </DropdownMenuContent>
              </DropdownMenu>

              {}
            <Button
                variant="ghost"
              size="sm"
              onClick={handleLogout}
                className={`flex-shrink-0 h-9 w-9 p-0 text-sidebar-foreground hover:bg-sidebar-accent ${isCollapsed ? 'w-full' : ''}`}
                title="Logout"
            >
                <LogOut className="h-4 w-4" />
            </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}