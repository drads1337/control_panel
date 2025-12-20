import { useMemo, useEffect, useState } from 'react'
import { useAuthContext } from '@/app/providers/auth-provider'
import { hasManagementAccess } from '@/lib/rbac'
import { useManagementStore } from '@/shared/model/use-management-store'
import { Key, Database, FolderOpen, Zap } from 'lucide-react'
import { getProductsCount } from '@/entities/product/api/product'
import { usePermissions } from '@/lib/hooks'

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
  const [productsCount, setProductsCount] = useState<number | null>(null)

  const permissionChecks = useMemo(() => {
    return hasManagementAccess(user)
  }, [user])

  let { canViewKeys, canViewFiles, canViewProducts, canViewAgents, canViewNotifications, hasAccess } = permissionChecks

  useEffect(() => {
    const loadProductsCount = async () => {

      if (canViewProducts) {
        setProductsCount(1)
        return
      }

      if (canViewKeys || hasPermission('keys.create')) {
        try {
          const response = await getProductsCount('all')
          if (response.success) {
            setProductsCount(response.count)
          } else {
            setProductsCount(0)
          }
        } catch (error) {

          setProductsCount(0)
        }
      } else {
        setProductsCount(0)
      }
    }

    if (isAuthenticated && user) {
      loadProductsCount()
    }
  }, [isAuthenticated, user, canViewProducts, canViewKeys, hasPermission])

  // Check for specific product permissions from rbac_service.py (lines 105-108 and 115-125)
  const hasAnyProductPermission = useMemo(() => {
    const productPermissions = [
      'products.view',
      'products.create',
      'products.edit',
      'products.upload_files',
      'products.manage_prices',
      'products.notifications_create',
      'products.notifications_edit',
      'products.notifications_delete',
      'products.changelog_view',
      'products.changelog_create',
      'products.changelog_edit',
      'products.changelog_delete',
      'products.status',
      'products.delete',
    ]
    return productPermissions.some(permission => hasPermission(permission))
  }, [hasPermission])

  const effectiveCanViewProducts = useMemo(() => {
    // Only show products tab if user has at least one of the specific product permissions
    if (!hasAnyProductPermission) return false
    if (canViewProducts) return true
    if ((canViewKeys || hasPermission('keys.create')) && productsCount !== null && productsCount > 0) {
      return true
    }
    return false
  }, [hasAnyProductPermission, canViewProducts, canViewKeys, hasPermission, productsCount])

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

    if (effectiveCanViewProducts) {
      tabs.push({
        value: 'product-database',
        label: 'Products',
        shortLabel: 'Apps',
        icon: Database,
      })
    }
    if (canViewAgents) {
      tabs.push({
        value: 'agent-manager',
        label: 'Agents',
        shortLabel: 'Agents',
        icon: Zap,
      })
    }
    return tabs
  }, [canViewKeys, canViewFiles, effectiveCanViewProducts, canViewAgents])

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.value === activeTab)) {
      setActiveTab(availableTabs[0].value)
    }
  }, [activeTab, availableTabs, setActiveTab])

  useEffect(() => {
    if (import.meta.env.DEV && !hasAccess && user) {
      const filesPermissions = user.permissions?.filter(p => p.startsWith('products.files_')) || []
      const productsPermissions = user.permissions?.filter(p => p.startsWith('products.')) || []
      const keysPermissions = user.permissions?.filter(p => p.startsWith('keys.')) || []
      const agentsPermissions = user.permissions?.filter(p => p.startsWith('agents.')) || []

    }
  }, [user, canViewKeys, canViewFiles, canViewProducts, canViewAgents, hasAccess])

  const effectiveHasAccess = hasAccess || effectiveCanViewProducts

  return {
    isAuthenticated,
    user,
    hasAccess: effectiveHasAccess,
    canViewKeys,
    canViewFiles,
    canViewProducts: effectiveCanViewProducts,
    canViewAgents,
    canViewNotifications,
    availableTabs,
    activeTab,
    setActiveTab,
  }
}
