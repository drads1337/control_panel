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

  const permissionChecks = useMemo(() => {
    return hasManagementAccess(user)
  }, [user])

  let { canViewKeys, canViewFiles, canViewGames, canViewLoaders, hasAccess } = permissionChecks

  useEffect(() => {
    const loadGamesCount = async () => {

      if (canViewGames) {
        setGamesCount(1)
        return
      }

      if (canViewKeys || hasPermission('keys.create')) {
        try {
          const response = await getGames('all')
          if (response.success && response.games) {
            setGamesCount(response.games.length)
          } else {
            setGamesCount(0)
          }
        } catch (error) {

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

  const effectiveCanViewGames = useMemo(() => {
    if (canViewGames) return true
    if ((canViewKeys || hasPermission('keys.create')) && gamesCount !== null && gamesCount > 0) {
      return true
    }
    return false
  }, [canViewGames, canViewKeys, hasPermission, gamesCount])

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

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.value === activeTab)) {
      setActiveTab(availableTabs[0].value)
    }
  }, [activeTab, availableTabs, setActiveTab])

  useEffect(() => {
    if (import.meta.env.DEV && !hasAccess && user) {
      const filesPermissions = user.permissions?.filter(p => p.startsWith('games.files_')) || []
      const gamesPermissions = user.permissions?.filter(p => p.startsWith('games.')) || []
      const keysPermissions = user.permissions?.filter(p => p.startsWith('keys.')) || []
      const loadersPermissions = user.permissions?.filter(p => p.startsWith('loaders.')) || []

    }
  }, [user, canViewKeys, canViewFiles, canViewGames, canViewLoaders, hasAccess])

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
