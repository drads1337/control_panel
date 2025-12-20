import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useIsMobile } from '@/lib/hooks'

const SIDEBAR_COOKIE_NAME = 'sidebar_state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

interface SidebarStateContextType {
  isCollapsed: boolean
  isMobileOpen: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setMobileOpen: (open: boolean) => void
}

const SidebarStateContext = createContext<SidebarStateContextType | undefined>(undefined)

/**
 * Reads sidebar state from cookie
 */
function readSidebarStateFromCookie(): boolean {
  if (typeof document === 'undefined') return true
  
  const cookies = document.cookie.split(';')
  const sidebarCookie = cookies.find(cookie => cookie.trim().startsWith(`${SIDEBAR_COOKIE_NAME}=`))
  
  if (sidebarCookie) {
    const value = sidebarCookie.split('=')[1]?.trim()
    return value === 'true'
  }
  
  return true // Default to open
}

/**
 * Writes sidebar state to cookie
 */
function writeSidebarStateToCookie(isOpen: boolean): void {
  if (typeof document === 'undefined') return
  
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${isOpen}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
}

/**
 * SidebarStateProvider manages sidebar state including:
 * - Cookie persistence (desktop sidebar state)
 * - Mobile sidebar state (temporary, no persistence)
 * - Keyboard shortcuts
 */
export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const [isCollapsed, setIsCollapsed] = useState(() => !readSidebarStateFromCookie())
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Initialize from cookie on mount
  useEffect(() => {
    if (!isMobile) {
      const initialState = readSidebarStateFromCookie()
      setIsCollapsed(!initialState)
    }
  }, [isMobile])

  // Save to cookie when desktop sidebar state changes
  useEffect(() => {
    if (!isMobile) {
      writeSidebarStateToCookie(!isCollapsed)
    }
  }, [isCollapsed, isMobile])

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    if (isMobile) {
      setIsMobileOpen(!collapsed)
    } else {
      setIsCollapsed(collapsed)
    }
  }, [isMobile])

  const setMobileOpen = useCallback((open: boolean) => {
    if (isMobile) {
      setIsMobileOpen(open)
    }
  }, [isMobile])

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen(prev => !prev)
    } else {
      setIsCollapsed(prev => !prev)
    }
  }, [isMobile])

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  const value: SidebarStateContextType = {
    isCollapsed,
    isMobileOpen,
    toggleSidebar,
    setSidebarCollapsed,
    setMobileOpen,
  }

  return (
    <SidebarStateContext.Provider value={value}>
      {children}
    </SidebarStateContext.Provider>
  )
}

/**
 * Hook to access sidebar state
 */
export function useSidebarState() {
  const context = useContext(SidebarStateContext)
  if (context === undefined) {
    throw new Error('useSidebarState must be used within a SidebarStateProvider')
  }
  return context
}

