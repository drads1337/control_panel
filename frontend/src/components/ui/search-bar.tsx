import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { 
  Search, 
  X, 
  Command,
  Users,
  Settings,
  Server,
  Gamepad2,
  FileText,
  Activity,
  Key,
  User,
  FolderOpen,
  Shield,
  Webhook,
  Monitor,
  BarChart3
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '@/contexts/auth-context'
import { usePermissions } from '@/hooks/use-permissions'
import type { User as UserType } from '@/entities/user';

interface SearchResult {
  id: string
  title: string
  description: string
  type: 'page' | 'user' | 'project' | 'server' | 'setting' | 'management' | 'security'
  icon: React.ReactNode
  href: string
  tags?: string[]
  permission?: string
  roles?: string[]
}

const getAllSearchItems = (): SearchResult[] => [

  { 
    id: 'dashboard', 
    title: 'Dashboard', 
    description: 'Main control panel', 
    type: 'page', 
    icon: <BarChart3 className="h-4 w-4" />, 
    href: '/dashboard' 
  },
  { 
    id: 'owner-dashboard', 
    title: 'Owner Dashboard', 
    description: 'Owner control panel', 
    type: 'page', 
    icon: <BarChart3 className="h-4 w-4" />, 
    href: '/owner-dashboard',
    roles: ['owner']
  },
  { 
    id: 'projects', 
    title: 'Projects', 
    description: 'Manage game projects', 
    type: 'project', 
    icon: <FolderOpen className="h-4 w-4" />, 
    href: '/projects',
    roles: ['owner']
  },
  { 
    id: 'servers', 
    title: 'Servers', 
    description: 'Monitor and manage servers', 
    type: 'server', 
    icon: <Server className="h-4 w-4" />, 
    href: '/servers',
    roles: ['owner']
  },
  { 
    id: 'users-management', 
    title: 'Users', 
    description: 'User management system', 
    type: 'user', 
    icon: <Users className="h-4 w-4" />, 
    href: '/users-management',
    permission: 'users.view'
  },
  { 
    id: 'management', 
    title: 'Management', 
    description: 'System management panel', 
    type: 'management', 
    icon: <Key className="h-4 w-4" />, 
    href: '/management-page',
    permission: 'keys.view'
  },
  { 
    id: 'remote-control', 
    title: 'Remote Control', 
    description: 'Remote control and monitoring', 
    type: 'page', 
    icon: <Monitor className="h-4 w-4" />, 
    href: '/remote-control',
    permission: 'remote_control.view'
  },
  { 
    id: 'security', 
    title: 'Security', 
    description: 'Security settings and monitoring', 
    type: 'security', 
    icon: <Shield className="h-4 w-4" />, 
    href: '/security',
    permission: 'system.view'
  },
  { 
    id: 'webhooks', 
    title: 'Webhooks', 
    description: 'Webhook management', 
    type: 'page', 
    icon: <Webhook className="h-4 w-4" />, 
    href: '/webhooks',
    permission: 'webhooks.view'
  },
  { 
    id: 'logs', 
    title: 'Logs', 
    description: 'System logs and events', 
    type: 'page', 
    icon: <FileText className="h-4 w-4" />, 
    href: '/logs',
    permission: 'logs.view'
  },
  { 
    id: 'settings', 
    title: 'Settings', 
    description: 'System settings', 
    type: 'setting', 
    icon: <Settings className="h-4 w-4" />, 
    href: '/settings',
    permission: 'project.view'
  },
  { 
    id: 'profile', 
    title: 'Profile', 
    description: 'User profile settings', 
    type: 'page', 
    icon: <User className="h-4 w-4" />, 
    href: '/profile' 
  },
  { 
    id: 'invite-codes', 
    title: 'Invite Codes', 
    description: 'Invite code management', 
    type: 'page', 
    icon: <Key className="h-4 w-4" />, 
    href: '/invite-codes' 
  },

  { 
    id: 'new-user', 
    title: 'Create User', 
    description: 'Add a new user', 
    type: 'user', 
    icon: <Users className="h-4 w-4" />, 
    href: '/users-management', 
    tags: ['create', 'add', 'new', 'user'],
    permission: 'users.create'
  },
  { 
    id: 'new-project', 
    title: 'New Project', 
    description: 'Create a new game project', 
    type: 'project', 
    icon: <Gamepad2 className="h-4 w-4" />, 
    href: '/projects', 
    tags: ['create', 'game', 'project'],
    roles: ['owner']
  },
  { 
    id: 'server-status', 
    title: 'Server Status', 
    description: 'Check server status', 
    type: 'server', 
    icon: <Server className="h-4 w-4" />, 
    href: '/servers', 
    tags: ['status', 'monitoring', 'check'],
    roles: ['owner']
  },
]

const isMac = () => {
  if (typeof window === 'undefined') return false
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
         navigator.userAgent.toUpperCase().indexOf('MAC') >= 0
}

interface SearchBarProps {
  className?: string
  placeholder?: string
}

export function SearchBar({ className = '', placeholder = 'Search the system...' }: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const { hasPermission, hasAnyRole } = usePermissions()
  const platformIsMac = useMemo(() => isMac(), [])

  const availableSearchItems = useMemo(() => {
    const allItems = getAllSearchItems()
    return allItems.filter(item => {

      if (item.permission && !hasPermission(item.permission)) {
        return false
      }

      if (item.roles && item.roles.length > 0) {
        if (!hasAnyRole(item.roles)) {
          return false
        }
      }

      return true
    })
  }, [hasPermission, hasAnyRole])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (query.trim()) {
      const lowerQuery = query.toLowerCase()
      const filtered = availableSearchItems.filter(item => {
        const titleMatch = item.title.toLowerCase().includes(lowerQuery)
        const descMatch = item.description.toLowerCase().includes(lowerQuery)
        const tagMatch = item.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        return titleMatch || descMatch || tagMatch
      })
      setResults(filtered)
      setSelectedIndex(0)
    } else {
      setResults([])
    }
  }, [query, availableSearchItems])

  const handleSelect = (result: SearchResult) => {
    navigate(result.href)
    setIsOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'page': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'user': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'project': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'server': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'setting': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'management': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'security': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'page': return 'Page'
      case 'user': return 'User'
      case 'project': return 'Project'
      case 'server': return 'Server'
      case 'setting': return 'Setting'
      case 'management': return 'Management'
      case 'security': return 'Security'
      default: return 'Other'
    }
  }

  return (
    <>
      <div className={`relative ${className}`}>
        <Button
          variant="outline"
          className="w-full justify-start text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
          onClick={() => setIsOpen(true)}
        >
          <Search className="mr-2 h-4 w-4" />
          <span className="flex-1 text-left">{placeholder}</span>
          <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded border bg-muted/50 text-xs font-mono">
            {platformIsMac ? (
              <>
                <Command className="h-3 w-3" />
                <span>K</span>
              </>
            ) : (
              <>
                <span>Ctrl</span>
                <span>K</span>
              </>
            )}
          </div>
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogPortal>
          <DialogOverlay className="bg-black/60 backdrop-blur-md supports-[backdrop-filter]:bg-black/40" />
          <DialogContent 
            className="sm:max-w-2xl max-w-[95vw] p-0 top-20 translate-y-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 [&>button]:hidden"
          >
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>Search the system for pages, users, projects, and more</DialogDescription>
          </DialogHeader>
          <div className="bg-background border rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center border-b px-4 py-3 bg-muted/30">
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search the system..."
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-base"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="ml-2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {results.length > 0 && (
              <div className="max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={result.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      index === selectedIndex ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex-shrink-0 text-muted-foreground">
                      {result.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{result.title}</span>
                        <Badge variant="secondary" className={`text-xs ${getTypeColor(result.type)} shrink-0`}>
                          {getTypeLabel(result.type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{result.description}</p>
                    </div>
                    {index === selectedIndex && (
                      <div className="flex-shrink-0 text-xs text-muted-foreground">
                        Enter
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {query && results.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">No results found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            )}

            {!query && (
              <div className="px-4 py-8 text-center text-muted-foreground">
                <Command className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">Start typing to search</p>
                <p className="text-sm mt-1">Use ↑↓ to navigate, Enter to select</p>
                <div className="mt-4 flex items-center justify-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono">
                      {platformIsMac ? '⌘' : 'Ctrl'}
                    </kbd>
                    <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono">K</kbd>
                    <span className="ml-1">to open</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  )
} 