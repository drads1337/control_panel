import { useMemo, useEffect, useState } from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { hasManagementAccess } from '@/lib/rbac-utils'
import { useManagementStore } from '@/stores/management-store'
import { Key, Database, FolderOpen, Zap } from 'lucide-react'
import { getGames } from '@/entities/game'
import { usePermissions } from '@/hooks/use-permissions'

export interface ManagementTab {
  value: string
  label: string
  shortLabel: string
  icon: React.ComponentType<{ className?: string }>
}

export function useManagementData() {
  const { isAuthenticated, user } = useAuthContext()
  const { activeTab, setActiveTab } = useManagementStore()
  const { hasPermission } = usePermissions()
  const [gamesCount, setGamesCount] = useState<number | null>(null)

  // Check if user has access to management via permissions
  const permissionChecks = useMemo(() => {
    return hasManagementAccess(user)
  }, [user])

  let { canViewKeys, canViewFiles, canViewGames, canViewLoaders, hasAccess } = permissionChecks

  // Load games count to check if user has access to games (even without global games.view)
  useEffect(() => {
    const loadGamesCount = async () => {
      // If user already has games.view permission, no need to check
      if (canViewGames) {
        setGamesCount(1) // Set to 1 to indicate games are available
        return
      }

      // If user has keys.create or keys.view, they might have access to specific games
      if (canViewKeys || hasPermission('keys.create')) {
        try {
          const response = await getGames('all')
          if (response.success && response.games) {
            setGamesCount(response.games.length)
          } else {
            setGamesCount(0)
          }
        } catch (error) {
          console.error('Error loading games for tab visibility:', error)
          setGamesCount(0)
        }
      } else {
        setGamesCount(0)
      }
    }

    if (isAuthenticated && user) {
      loadGamesCount()
    }
  }, [isAuthenticated, user, canViewGames, canViewKeys, hasPermission])

  // Calculate effective canViewGames based on games count
  // Update canViewGames if user has access to games via games array (even without global permission)
  // If user has keys.create or keys.view and has at least one game, they can view games tab
  const effectiveCanViewGames = useMemo(() => {
    if (canViewGames) return true
    if ((canViewKeys || hasPermission('keys.create')) && gamesCount !== null && gamesCount > 0) {
      return true
    }
    return false
  }, [canViewGames, canViewKeys, hasPermission, gamesCount])

  // Define available tabs based on permissions
  const availableTabs = useMemo<ManagementTab[]>(() => {
    const tabs: ManagementTab[] = []
    if (canViewKeys) {
      tabs.push({
        value: 'license-keys',
        label: 'License Keys',
        shortLabel: 'Keys',
        icon: Key,
      })
    }
    if (canViewFiles) {
      tabs.push({
        value: 'file-manager',
        label: 'File Manager',
        shortLabel: 'Files',
        icon: FolderOpen,
      })
    }
    // Show games tab if user has games.view permission OR has keys permission and games are available
    if (effectiveCanViewGames) {
      tabs.push({
        value: 'game-database',
        label: 'Applications',
        shortLabel: 'Apps',
        icon: Database,
      })
    }
    if (canViewLoaders) {
      tabs.push({
        value: 'loader-manager',
        label: 'Loaders',
        shortLabel: 'Loaders',
        icon: Zap,
      })
    }
    return tabs
  }, [canViewKeys, canViewFiles, canViewGames, canViewLoaders, gamesCount, hasPermission])

  // Ensure active tab is available, otherwise switch to first available tab
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.value === activeTab)) {
      setActiveTab(availableTabs[0].value)
    }
  }, [activeTab, availableTabs, setActiveTab])

  // Debug logging - only log when access is denied and in development mode
  useEffect(() => {
    if (import.meta.env.DEV && !hasAccess && user) {
      const filesPermissions = user.permissions?.filter(p => p.startsWith('games.files_')) || []
      const gamesPermissions = user.permissions?.filter(p => p.startsWith('games.')) || []
      const keysPermissions = user.permissions?.filter(p => p.startsWith('keys.')) || []
      const loadersPermissions = user.permissions?.filter(p => p.startsWith('loaders.')) || []

      console.warn('🔐 MANAGEMENT_ACCESS_DENIED:', {
        user_id: user.id,
        username: user.username,
        roles: user.roles,
        permissions_count: user.permissions?.length || 0,
        canViewKeys,
        canViewFiles,
        canViewGames,
        canViewLoaders,
        keys_permissions: keysPermissions,
        files_permissions: filesPermissions,
        games_permissions: gamesPermissions,
        loaders_permissions: loadersPermissions,
      })
    }
  }, [user, canViewKeys, canViewFiles, canViewGames, canViewLoaders, hasAccess])

  // Calculate effective hasAccess
  const effectiveHasAccess = hasAccess || effectiveCanViewGames

  return {
    isAuthenticated,
    user,
    hasAccess: effectiveHasAccess,
    canViewKeys,
    canViewFiles,
    canViewGames: effectiveCanViewGames,
    canViewLoaders,
    availableTabs,
    activeTab,
    setActiveTab,
  }
}

