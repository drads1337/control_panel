import type { User } from '@/entities/user'

// Role hierarchy (higher = more privileged)
const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 90,
  manager: 80,
  seller: 70,
  client: 10,
}

// Role display names
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  manager: 'Manager',
  seller: 'Seller',
  client: 'Client',
  moderator: 'Moderator',
}

// Role colors (for UI display)
const ROLE_COLORS: Record<string, string> = {
  owner: 'text-purple-600 dark:text-purple-400',
  admin: 'text-red-600 dark:text-red-400',
  manager: 'text-blue-600 dark:text-blue-400',
  seller: 'text-green-600 dark:text-green-400',
  client: 'text-gray-600 dark:text-gray-400',
  moderator: 'text-orange-600 dark:text-orange-400',
}

/**
 * Check if user has a specific permission
 * Owners and admins have all permissions
 * Supports wildcard permissions (e.g., "logs.*" matches "logs.view")
 */
export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) {
    return false
  }

  // Owners and admins have all permissions
  const isOwnerResult = isOwner(user)
  const isAdminResult = isAdmin(user)
  
  if (isOwnerResult || isAdminResult) {
    return true
  }

  // Check user's permissions array
  const userPermissions = user.permissions || []
  
  // Check for exact match
  if (userPermissions.includes(permission)) {
    return true
  }

  // Check for wildcard permissions
  // If user has "logs.*", they have all "logs.*" permissions
  const permissionParts = permission.split('.')
  for (let i = permissionParts.length; i > 0; i--) {
    const wildcardPermission = permissionParts.slice(0, i).join('.') + '.*'
    if (userPermissions.includes(wildcardPermission)) {
      return true
    }
  }

  // Check for global wildcard
  if (userPermissions.includes('*')) {
    return true
  }

  return false
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: User | null, roles: string[]): boolean {
  if (!user || !roles.length) return false

  const userRoles = user.roles || []
  return roles.some(role => userRoles.includes(role))
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(user: User | null, roles: string[]): boolean {
  if (!user || !roles.length) return false

  const userRoles = user.roles || []
  return roles.every(role => userRoles.includes(role))
}

/**
 * Check if user can access a specific feature
 * This is a convenience wrapper around hasPermission
 * Features typically map to permissions (e.g., 'dashboard' -> 'dashboard.view')
 */
export function canAccessFeature(user: User | null, feature: string): boolean {
  if (!user) return false

  // Owners and admins can access all features
  if (isOwner(user) || isAdmin(user)) {
    return true
  }

  // Try feature permission first
  if (hasPermission(user, `${feature}.view`) || hasPermission(user, feature)) {
    return true
  }

  // Some features might be role-based
  const featureRoleMap: Record<string, string[]> = {
    dashboard: ['owner', 'admin', 'manager', 'seller'],
    analytics: ['owner', 'admin', 'manager'],
    settings: ['owner', 'admin'],
  }

  const allowedRoles = featureRoleMap[feature]
  if (allowedRoles) {
    return hasAnyRole(user, allowedRoles)
  }

  return false
}

/**
 * Check if user is an admin
 * Checks both roles array and rbac_roles array
 * Owners are also considered admins
 */
export function isAdmin(user: User | null): boolean {
  if (!user) {
    return false
  }

  // Owners are admins
  if (isOwner(user)) {
    return true
  }

  // Check roles array
  const roles = user.roles || []
  const hasAdminInRoles = roles.some(role => ['admin', 'administrator'].includes(role.toLowerCase()))
  if (hasAdminInRoles) {
    return true
  }

  // Check rbac_roles array
  const rbacRoles = user.rbac_roles || []
  if (rbacRoles.length > 0) {
    const roleNames = rbacRoles
      .map(r => (typeof r === 'string' ? r : r?.name || ''))
      .map(name => name.toLowerCase())
    const hasAdminInRbacRoles = roleNames.some(name => ['admin', 'administrator', 'owner'].includes(name))
    if (hasAdminInRbacRoles) {
      return true
    }
  }

  return false
}

/**
 * Check if user is an owner
 * Checks both roles array and rbac_roles array
 */
export function isOwner(user: User | null): boolean {
  if (!user) {
    return false
  }

  // Check roles array
  const roles = user.roles || []
  const hasOwnerInRoles = roles.some(role => role.toLowerCase() === 'owner')
  if (hasOwnerInRoles) {
    return true
  }

  // Check rbac_roles array
  const rbacRoles = user.rbac_roles || []
  if (rbacRoles.length > 0) {
    const roleNames = rbacRoles
      .map(r => (typeof r === 'string' ? r : r?.name || ''))
      .map(name => name.toLowerCase())
    const hasOwnerInRbacRoles = roleNames.some(name => name === 'owner')
    if (hasOwnerInRbacRoles) {
      return true
    }
  }

  return false
}

/**
 * Check if user is a seller
 */
export function isSeller(user: User | null): boolean {
  if (!user) return false
  return user.roles?.includes('seller') ?? false
}


/**
 * Check if user is a client
 */
export function isClient(user: User | null): boolean {
  if (!user) return false
  return user.roles?.includes('client') ?? false
}

/**
 * Get the primary role for a user (highest privilege role)
 */
export function getPrimaryRole(user: User | null): string | null {
  if (!user || !user.roles || user.roles.length === 0) {
    return null
  }

  // Sort roles by hierarchy and return the highest
  const sortedRoles = [...user.roles].sort((a, b) => {
    const aLevel = ROLE_HIERARCHY[a.toLowerCase()] || 0
    const bLevel = ROLE_HIERARCHY[b.toLowerCase()] || 0
    return bLevel - aLevel
  })

  return sortedRoles[0] || null
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: string | null): string {
  if (!role) return ''
  return ROLE_DISPLAY_NAMES[role.toLowerCase()] || role.charAt(0).toUpperCase() + role.slice(1)
}

/**
 * Get color class for a role (for UI display)
 */
export function getRoleColor(role: string | null): string {
  if (!role) return 'text-gray-600 dark:text-gray-400'
  return ROLE_COLORS[role.toLowerCase()] || 'text-gray-600 dark:text-gray-400'
}

/**
 * Check if user can manage another user
 * Owners and admins can manage anyone except other owners
 * Managers can manage lower-level users
 */
export function canManageUser(user: User | null, targetUser: User | null): boolean {
  if (!user || !targetUser) return false

  // Can't manage yourself
  if (user.id === targetUser.id) return false

  // Owners can manage anyone except other owners
  if (isOwner(user)) {
    return !isOwner(targetUser)
  }

  // Admins can manage anyone except owners and other admins
  if (isAdmin(user)) {
    return !isOwner(targetUser) && !isAdmin(targetUser)
  }

  // Check permission
  if (hasPermission(user, 'users.manage')) {
    const userLevel = ROLE_HIERARCHY[getPrimaryRole(user) || ''] || 0
    const targetLevel = ROLE_HIERARCHY[getPrimaryRole(targetUser) || ''] || 0
    return userLevel > targetLevel
  }

  return false
}

/**
 * Check if user can assign a specific role
 * Owners and admins can assign any role except owner
 * Others need specific permissions
 */
export function canAssignRole(user: User | null, role: string): boolean {
  if (!user) return false

  // Owners can assign any role except owner
  if (isOwner(user)) {
    return role.toLowerCase() !== 'owner'
  }

  // Admins can assign roles except owner and admin
  if (isAdmin(user)) {
    const lowerRole = role.toLowerCase()
    return lowerRole !== 'owner' && lowerRole !== 'admin'
  }

  // Check permission
  if (hasPermission(user, 'rbac.assign_role')) {
    const userLevel = ROLE_HIERARCHY[getPrimaryRole(user) || ''] || 0
    const roleLevel = ROLE_HIERARCHY[role.toLowerCase()] || 0
    return userLevel > roleLevel
  }

  return false
}

/**
 * Check if user can remove a specific role
 * Similar rules to canAssignRole
 */
export function canRemoveRole(user: User | null, role: string): boolean {
  if (!user) return false

  // Owners can remove any role except owner
  if (isOwner(user)) {
    return role.toLowerCase() !== 'owner'
  }

  // Admins can remove roles except owner and admin
  if (isAdmin(user)) {
    const lowerRole = role.toLowerCase()
    return lowerRole !== 'owner' && lowerRole !== 'admin'
  }

  // Check permission
  if (hasPermission(user, 'rbac.remove_role')) {
    const userLevel = ROLE_HIERARCHY[getPrimaryRole(user) || ''] || 0
    const roleLevel = ROLE_HIERARCHY[role.toLowerCase()] || 0
    return userLevel > roleLevel
  }

  return false
}

/**
 * Check if user has access to management features
 * Returns an object with flags for each management section
 * Owners and admins have full access to all sections
 */
export function hasManagementAccess(user: User | null): {
  canViewKeys: boolean
  canViewFiles: boolean
  canViewProducts: boolean
  canViewAgents: boolean
  canViewNotifications: boolean
  hasAccess: boolean
} {
  if (!user) {
    return {
      canViewKeys: false,
      canViewFiles: false,
      canViewProducts: false,
      canViewAgents: false,
      canViewNotifications: false,
      hasAccess: false,
    }
  }

  // Owners and admins have full access to all management sections
  const isOwnerOrAdmin = isOwner(user) || isAdmin(user)
  if (isOwnerOrAdmin) {
    return {
      canViewKeys: true,
      canViewFiles: true,
      canViewProducts: true,
      canViewAgents: true,
      canViewNotifications: true,
      hasAccess: true,
    }
  }

  // Check keys permissions
  const canViewKeys = hasPermission(user, 'keys.view') || hasPermission(user, 'keys.create')

  // Check files permissions (products.files_view or any files permission)
  const canViewFiles = hasPermission(user, 'products.files_view') ||
    hasPermission(user, 'products.files_upload') ||
    hasPermission(user, 'products.files_delete') ||
    hasPermission(user, 'products.files_download') ||
    hasPermission(user, 'products.files_manage_configs') ||
    hasPermission(user, 'products.files_manage_resources')

  // Check products permissions
  const canViewProducts = hasPermission(user, 'products.view')

  // Check agents permissions
  const canViewAgents = hasPermission(user, 'agents.view')

  // Check notifications permissions
  const canViewNotifications = hasPermission(user, 'products.notifications_view') ||
    hasPermission(user, 'products.notifications_create') ||
    hasPermission(user, 'products.notifications_edit') ||
    hasPermission(user, 'agents.notifications_view') ||
    hasPermission(user, 'agents.notifications_create') ||
    hasPermission(user, 'agents.notifications_edit')

  // User has access if they can view any management section
  const hasAccess = canViewKeys || canViewFiles || canViewProducts || canViewAgents || canViewNotifications

  return {
    canViewKeys,
    canViewFiles,
    canViewProducts,
    canViewAgents,
    canViewNotifications,
    hasAccess,
  }
}

