import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogOverlay, 
  DialogPortal, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog'
import { 
  Search, 
  X, 
  Command,
  Users,
  Settings,
  FileText,
  Key,
  User,
  Shield,
  Webhook,
  LayoutDashboard,
  Settings2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '@/shared/hooks/use-permissions'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  title: string
  description: string
  type: 'page' | 'user' | 'management' | 'security'
  icon: React.ReactNode
  href: string
  tags?: string[]
  permission?: string
}

const getAllSearchItems = (): SearchResult[] => [
  { 
    id: 'dashboard', 
    title: 'Dashboard', 
    description: 'Main control panel', 
    type: 'page', 
    icon: <LayoutDashboard className="h-4 w-4" />, 
    href: '/dashboard' 
  },
  { 
    id: 'users', 
    title: 'Users', 
    description: 'User management system', 
    type: 'user', 
    icon: <Users className="h-4 w-4" />, 
    href: '/users',
    permission: 'users.view',
    tags: ['users', 'management', 'people']
  },
  { 
    id: 'management', 
    title: 'Management', 
    description: 'System management panel', 
    type: 'management', 
    icon: <Key className="h-4 w-4" />, 
    href: '/management-page',
    permission: 'keys.view',
    tags: ['keys', 'management', 'api']
  },
  { 
    id: 'security', 
    title: 'Security', 
    description: 'Security settings and monitoring', 
    type: 'security', 
    icon: <Shield className="h-4 w-4" />, 
    href: '/security',
    permission: 'system.view',
    tags: ['security', 'settings', 'monitoring']
  },
  { 
    id: 'webhooks', 
    title: 'Webhooks', 
    description: 'Webhook management', 
    type: 'page', 
    icon: <Webhook className="h-4 w-4" />, 
    href: '/webhooks',
    permission: 'webhooks.view',
    tags: ['webhooks', 'integrations']
  },
  { 
    id: 'logs', 
    title: 'Logs', 
    description: 'System logs and events', 
    type: 'page', 
    icon: <FileText className="h-4 w-4" />, 
    href: '/logs',
    permission: 'logs.view',
    tags: ['logs', 'events', 'history']
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
    id: 'project-settings', 
    title: 'Project Settings', 
    description: 'Project configuration', 
    type: 'page', 
    icon: <Settings2 className="h-4 w-4" />, 
    href: '/project-settings',
    permission: 'project.view',
    tags: ['settings', 'project', 'configuration']
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
  variant?: 'inline' | 'button'
}

export function SearchBar({ 
  className = '', 
  placeholder = 'Search...',
  variant = 'inline'
}: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const platformIsMac = useMemo(() => isMac(), [])

  const availableSearchItems = useMemo(() => {
    const allItems = getAllSearchItems()
    return allItems.filter(item => {
      if (item.permission && !hasPermission(item.permission)) {
        return false
      }
      return true
    })
  }, [hasPermission])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

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
      case 'management': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'security': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'page': return 'Page'
      case 'user': return 'User'
      case 'management': return 'Management'
      case 'security': return 'Security'
      default: return 'Other'
    }
  }

  if (variant === 'button') {
    return (
      <>
        <Button
          variant="outline"
          className={cn(
            "hidden md:flex h-8 w-[200px] justify-start text-sm text-muted-foreground hover:bg-muted/50 transition-colors",
            className
          )}
          onClick={() => setIsOpen(true)}
        >
          <Search className="mr-2 h-4 w-4" />
          <span className="flex-1 text-left">{placeholder}</span>
          <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded border bg-muted/50 text-xs font-sans">
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

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogPortal>
            <DialogOverlay className="bg-black/60 backdrop-blur-md supports-[backdrop-filter]:bg-black/40" />
            <DialogContent 
              className="sm:max-w-2xl max-w-[95vw] p-0 top-20 translate-y-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 [&>button]:hidden"
            >
              <DialogHeader className="sr-only">
                <DialogTitle>Search</DialogTitle>
                <DialogDescription>Search the system for pages, users, and more</DialogDescription>
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
                        <kbd className="px-1.5 py-0.5 rounded border bg-muted font-sans">
                          {platformIsMac ? '⌘' : 'Ctrl'}
                        </kbd>
                        <kbd className="px-1.5 py-0.5 rounded border bg-muted font-sans">K</kbd>
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

  // Inline variant - clickable input that opens dialog
  return (
    <>
      <div className={cn("relative", className)}>
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder={placeholder}
          className="h-8 w-[200px] pl-8 pr-2 text-sm cursor-pointer"
          onClick={() => setIsOpen(true)}
          readOnly
        />
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogPortal>
          <DialogOverlay className="bg-black/60 backdrop-blur-md supports-[backdrop-filter]:bg-black/40" />
          <DialogContent 
            className="sm:max-w-2xl max-w-[95vw] p-0 top-20 translate-y-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 [&>button]:hidden"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Search</DialogTitle>
              <DialogDescription>Search the system for pages, users, and more</DialogDescription>
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
                      <kbd className="px-1.5 py-0.5 rounded border bg-muted font-sans">
                        {platformIsMac ? '⌘' : 'Ctrl'}
                      </kbd>
                      <kbd className="px-1.5 py-0.5 rounded border bg-muted font-sans">K</kbd>
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

