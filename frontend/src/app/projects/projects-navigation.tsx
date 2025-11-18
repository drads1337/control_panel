import React from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FolderOpen,
  Key,
  Settings,
  Users,
  Server,
  Activity,
  FileText,
  BarChart3,
  User,
  LayoutGrid,
  FolderPlus,
  Monitor,
  Shield,
  Webhook,
} from 'lucide-react'
import { useAuthContext } from '@/contexts/auth-context'
import { getPrimaryRole } from '@/lib/rbac-utils'
import type { User as UserType } from '@/entities/user';
import type { Project } from '@/entities/project';

interface ProjectsNavigationProps {
  activeTab: 'projects' | 'project-codes'
  onTabChange: (tab: 'projects' | 'project-codes') => void
}

const getNavigationItems = (role?: string) => {
  if (role === 'owner') {
    return [
      { title: 'Dashboard', icon: <BarChart3 className="mr-2 h-4 w-4" />, href: '/dashboard' },
      { title: 'Projects', icon: <FolderOpen className="mr-2 h-4 w-4" />, href: '/projects' },
      { title: 'Servers', icon: <Server className="mr-2 h-4 w-4" />, href: '/servers' },
      { title: 'Sessions', icon: <Activity className="mr-2 h-4 w-4" />, href: '/sessions' },
      { title: 'Logs', icon: <FileText className="mr-2 h-4 w-4" />, href: '/logs' },
      { title: 'Profile', icon: <User className="mr-2 h-4 w-4" />, href: '/profile' },
    ]
  } else if (role === 'admin' || role === 'moderator') {
    return [
      { title: 'Dashboard', icon: <BarChart3 className="mr-2 h-4 w-4" />, href: '/dashboard' },
      { title: 'Management', icon: <Key className="mr-2 h-4 w-4" />, href: '/management-page' },
      { title: 'Remote Control', icon: <Monitor className="mr-2 h-4 w-4" />, href: '/remote-control' },
      { title: 'Users', icon: <Users className="mr-2 h-4 w-4" />, href: '/users' },
      { title: 'Security', icon: <Shield className="mr-2 h-4 w-4" />, href: '/security' },
      { title: 'Webhooks', icon: <Webhook className="mr-2 h-4 w-4" />, href: '/webhooks' },
      { title: 'Logs', icon: <FileText className="mr-2 h-4 w-4" />, href: '/logs' },
      { title: 'Settings', icon: <Settings className="mr-2 h-4 w-4" />, href: '/settings' },
      { title: 'Profile', icon: <User className="mr-2 h-4 w-4" />, href: '/profile' },
    ]
  } else {

    return [
      { title: 'Dashboard', icon: <BarChart3 className="mr-2 h-4 w-4" />, href: '/dashboard' },
      { title: 'Management', icon: <Key className="mr-2 h-4 w-4" />, href: '/management-page' },
      { title: 'Profile', icon: <User className="mr-2 h-4 w-4" />, href: '/profile' },
    ]
  }
}

export function ProjectsNavigation({ activeTab, onTabChange }: ProjectsNavigationProps) {
  const { user } = useAuthContext()
  const navigationItems = getNavigationItems(getPrimaryRole(user) || undefined)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
      {}
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as any)}>
        <TabsList>
          <TabsTrigger value="projects">
            <FolderOpen className="mr-2 h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="project-codes">
            <FolderPlus className="mr-2 h-4 w-4" />
            Project Codes
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}