import type { NavigationItem } from '../model/types'
import type { User } from '@/entities/user'

/**
 * Check if user has a specific permission
 */
function hasPermission(user: User, permission: string): boolean {
  if (!user) return false
  
  // Check if user has the permission in their permissions array
  if (user.permissions && user.permissions.includes(permission)) {
    return true
  }
  
  // Check if user has the permission through RBAC roles
  if (user.rbac_roles && user.rbac_roles.length > 0) {
    // RBAC roles might have permissions, but we don't have that data here
    // This is a simplified check - backend is the source of truth
    return false
  }
  
  return false
}

/**
 * Check if user has any of the specified roles
 */
function hasAnyRole(user: User, roles: string[]): boolean {
  if (!user || !roles || roles.length === 0) return false
  
  // Check user.roles array
  if (user.roles && user.roles.some(role => roles.includes(role))) {
    return true
  }
  
  // Check RBAC roles
  if (user.rbac_roles && user.rbac_roles.length > 0) {
    const rbacRoleNames = user.rbac_roles.map(r => r.name)
    if (rbacRoleNames.some(role => roles.includes(role))) {
      return true
    }
  }
  
  return false
}

/**
 * Check if user has all of the specified roles
 */
function hasAllRoles(user: User, roles: string[]): boolean {
  if (!user || !roles || roles.length === 0) return false
  
  const userRoles = [
    ...(user.roles || []),
    ...(user.rbac_roles?.map(r => r.name) || [])
  ]
  
  return roles.every(role => userRoles.includes(role))
}

/**
 * Check if user can access a navigation item based on permissions and roles
 */
export function canAccessNavigationItem(item: NavigationItem, user: User | null): boolean {
  if (!user) return false
  
  // If no permission or role requirements, allow access
  if (!item.permission && !item.permissions && !item.roles) {
    return true
  }
  
  // Check single permission
  if (item.permission) {
    if (hasPermission(user, item.permission)) {
      return true
    }
  }
  
  // Check multiple permissions
  if (item.permissions && item.permissions.length > 0) {
    const requireAll = item.requireAll === true
    if (requireAll) {
      // User must have all permissions
      if (!item.permissions.every(perm => hasPermission(user, perm))) {
        return false
      }
    } else {
      // User must have at least one permission
      if (!item.permissions.some(perm => hasPermission(user, perm))) {
        return false
      }
    }
  }
  
  // Check permission prefixes
  if (item.permissionPrefix) {
    const hasPrefixPermission = user.permissions?.some(perm => 
      perm.startsWith(item.permissionPrefix!)
    )
    if (!hasPrefixPermission) {
      return false
    }
  }
  
  if (item.permissionPrefixes && item.permissionPrefixes.length > 0) {
    const requireAll = item.requireAll === true
    const hasPrefixPermissions = item.permissionPrefixes.map(prefix =>
      user.permissions?.some(perm => perm.startsWith(prefix))
    )
    
    if (requireAll) {
      if (!hasPrefixPermissions.every(Boolean)) {
        return false
      }
    } else {
      if (!hasPrefixPermissions.some(Boolean)) {
        return false
      }
    }
  }
  
  // Check roles
  if (item.roles && item.roles.length > 0) {
    const requireAnyRole = item.requireAnyRole !== false // Default to any role if not specified
    if (requireAnyRole) {
      // User must have at least one role
      if (!hasAnyRole(user, item.roles)) {
        return false
      }
    } else {
      // User must have all roles
      if (!hasAllRoles(user, item.roles)) {
        return false
      }
    }
  }
  
  // If we got here, all checks passed
  return true
}

/**
 * Get the first available page from navigation items that the user can access
 */
export function getFirstAvailablePageFromNavigation(
  items: NavigationItem[],
  user: User | null
): string {
  if (!user || !items || items.length === 0) {
    return '/profile'
  }
  
  // Find the first item the user can access
  for (const item of items) {
    if (canAccessNavigationItem(item, user) && item.href) {
      return item.href
    }
  }
  
  // If no accessible item found, default to profile
  return '/profile'
}

