import { useMemo } from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { 
  hasPermission, 
  hasAnyRole, 
  hasAllRoles, 
  canAccessFeature,
  isAdmin,
  isOwner,
  isSeller,
  isDeveloper,
  isSupport,
  isClient,
  getPrimaryRole,
  getRoleDisplayName,
  getRoleColor,
  canManageUser,
  canAssignRole,
  canRemoveRole
} from '@/lib/rbac-utils'

/**
 * Hook for working with user permissions and roles
 * Provides reactive permission checks and role utilities
 */
export function usePermissions() {
  const { user, isAuthenticated, isInitialized } = useAuthContext()

  const permissions = useMemo(() => {
    if (!isAuthenticated || !user) {
      return {
        // Permission checks
        hasPermission: () => false,
        hasAnyPermission: () => false,
        hasAllPermissions: () => false,
        
        // Role checks
        hasRole: () => false,
        hasAnyRole: () => false,
        hasAllRoles: () => false,
        
        // Feature access
        canAccessFeature: () => false,
        
        // Role utilities
        isAdmin: false,
        isOwner: false,
        isSeller: false,
        isDeveloper: false,
        isSupport: false,
        isClient: false,
        
        // Role info
        primaryRole: null,
        roleDisplayName: '',
        roleColor: '',
        
        // User management
        canManageUser: () => false,
        canAssignRole: () => false,
        canRemoveRole: () => false,
        
        // Available roles for assignment
        availableRoles: [],
        
        // User info
        user,
        isAuthenticated,
        isInitialized
      }
    }

    return {
      // Permission checks
      hasPermission: (permission: string) => hasPermission(user, permission),
      hasAnyPermission: (permissions: string[]) => permissions.some(p => hasPermission(user, p)),
      hasAllPermissions: (permissions: string[]) => permissions.every(p => hasPermission(user, p)),
      
      // Role checks
      hasRole: (role: string) => hasAnyRole(user, [role]),
      hasAnyRole: (roles: string[]) => hasAnyRole(user, roles),
      hasAllRoles: (roles: string[]) => hasAllRoles(user, roles),
      
      // Feature access
      canAccessFeature: (feature: string) => canAccessFeature(user, feature),
      
      // Role utilities
      isAdmin: isAdmin(user),
      isOwner: isOwner(user),
      isSeller: isSeller(user),
      isDeveloper: isDeveloper(user),
      isSupport: isSupport(user),
      isClient: isClient(user),
      
      // Role info
      primaryRole: getPrimaryRole(user),
      roleDisplayName: getRoleDisplayName(getPrimaryRole(user) || ''),
      roleColor: getRoleColor(getPrimaryRole(user) || ''),
      
      // User management
      canManageUser: (targetUser: any) => canManageUser(user, targetUser),
      canAssignRole: (role: string) => canAssignRole(user, role),
      canRemoveRole: (role: string) => canRemoveRole(user, role),
      
      // Available roles for assignment
      availableRoles: getAvailableRolesForAssignment(user),
      
      // User info
      user,
      isAuthenticated,
      isInitialized
    }
  }, [user, isAuthenticated, isInitialized])

  return permissions
}

/**
 * Hook for checking specific permissions
 */
export function usePermissionCheck(permission: string) {
  const { hasPermission } = usePermissions()
  return hasPermission(permission)
}

/**
 * Hook for checking multiple permissions
 */
export function usePermissionChecks(permissions: string[], requireAll = false) {
  const { hasAnyPermission, hasAllPermissions } = usePermissions()
  
  if (requireAll) {
    return hasAllPermissions(permissions)
  }
  
  return hasAnyPermission(permissions)
}

/**
 * Hook for checking roles
 */
export function useRoleCheck(roles: string[], requireAll = false) {
  const { hasAnyRole, hasAllRoles } = usePermissions()
  
  if (requireAll) {
    return hasAllRoles(roles)
  }
  
  return hasAnyRole(roles)
}

/**
 * Hook for checking feature access
 */
export function useFeatureAccess(feature: string) {
  const { canAccessFeature } = usePermissions()
  return canAccessFeature(feature)
}

/**
 * Hook for user management permissions
 */
export function useUserManagement() {
  const { 
    canManageUser, 
    canAssignRole, 
    canRemoveRole, 
    availableRoles,
    isAdmin,
    isOwner 
  } = usePermissions()

  return {
    canManageUser,
    canAssignRole,
    canRemoveRole,
    availableRoles,
    isAdmin,
    isOwner
  }
}

/**
 * Helper function to get available roles for assignment
 */
function getAvailableRolesForAssignment(user: any): string[] {
  if (!user) return []

  // Static roles (owner, admin) cannot be assigned through interface
  // Only RBAC roles can be assigned
  if (isOwner(user) || isAdmin(user)) {
    return ['manager', 'seller', 'developer', 'support', 'client']
  }
  
  return []
}
