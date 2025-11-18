import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Users as UsersIcon } from 'lucide-react'
import type { Project } from '@/entities/project';
import type { User } from '@/entities/user';

interface PageConfig {
  title: string
  actions?: React.ReactNode
}

export function usePageConfig(): PageConfig {
  const location = useLocation()

  const configs: Record<string, PageConfig> = {
    '/dashboard': { 
      title: 'Dashboard'
    },
    '/projects': { 
      title: 'Projects',
      actions: <Button variant="outline" size="sm">
        <UsersIcon className="h-4 w-4 mr-2" />
        Create Project
      </Button>
    },
    '/servers': { 
      title: 'Servers',
      actions: <Button variant="outline" size="sm">
        <UsersIcon className="h-4 w-4 mr-2" />
        Add Server
      </Button>
    },
    '/users': { 
      title: 'Users',
      actions: <Button variant="outline" size="sm">
        <UsersIcon className="h-4 w-4 mr-2" />
        Add User
      </Button>
    },
    '/settings': { 
      title: 'Settings'
    },
    '/logs': { 
      title: 'Logs'
    },
    '/profile': { 
      title: 'Profile'
    },
    '/management-page': { 
      title: 'Management'
    },
    '/invite-codes': { 
      title: 'Invite Codes',
      actions: <Button variant="outline" size="sm">
        <UsersIcon className="h-4 w-4 mr-2" />
        Create Code
      </Button>
    },
    '/sessions': { 
      title: 'Sessions'
    },
    '/security': { 
      title: 'Security'
    },
    '/webhooks': { 
      title: 'Webhooks'
    },
    '/remote-control': { 
      title: 'Remote Control'
    },
    '/presentation': {
      title: 'Presentation'
    }
  }

  return configs[location.pathname] || { title: 'Panel' }
}
