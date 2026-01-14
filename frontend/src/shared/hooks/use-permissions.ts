import { useMemo } from 'react'
import * as React from 'react'
import { useAuthContext } from '@/app/providers/auth-provider'
import { authService } from '@/shared/api/auth-service'
import { 
  hasPermission, 
  hasAnyRole, 
  hasAllRoles, 
  canAccessFeature,
  isAdmin,
  isOwner,
  isSeller,
  isClient,
  getPrimaryRole,
  getRoleDisplayName,
  getRoleColor,
  canManageUser,
  canAssignRole,
  canRemoveRole
} from '@/shared/lib/rbac'

// SECURITY NOTE: Frontend RBAC checks are for UX ONLY, NOT for security
// All API endpoints on the backend MUST duplicate these permission checks
// Attackers can bypass frontend checks by calling APIs directly
// Never rely on frontend checks for authorization - they are purely cosmetic
// Backend is the source of truth for all permission checks

export function usePermissions() {
  const authContext = useAuthContext()
  const { user: contextUser, isAuthenticated, isInitialized } = authContext
  
  // Try to get user from cache synchronously if context user is not available
  const cachedUser = React.useMemo(() => {
    if (contextUser) {
      return null
    }
    try {
      return authService.getCachedUserFromMemory() || null
    } catch (e) {
      return null
    }
  }, [contextUser])
  
  // Use context user if available, otherwise try cached user
  const user = contextUser || cachedUser

  const permissions = useMemo(() => {
    // Use user presence as primary check, isAuthenticated might be out of sync
    if (!user) {
      return {

        hasPermission: () => false,
        hasAnyPermission: () => false,
        hasAllPermissions: () => false,

        hasRole: () => false,
        hasAnyRole: () => false,
        hasAllRoles: () => false,

        canAccessFeature: () => false,

        isAdmin: false,
        isOwner: false,
        isSeller: false,
        isClient: false,

        primaryRole: null,
        roleDisplayName: '',
        roleColor: '',

        canManageUser: () => false,
        canAssignRole: () => false,
        canRemoveRole: () => false,

        availableRoles: [],

        user,
        isAuthenticated,
        isInitialized
      }
    }

    return {

      hasPermission: (permission: string) => hasPermission(user, permission),
      hasAnyPermission: (permissions: string[]) => permissions.some(p => hasPermission(user, p)),
      hasAllPermissions: (permissions: string[]) => permissions.every(p => hasPermission(user, p)),

      hasRole: (role: string) => hasAnyRole(user, [role]),
      hasAnyRole: (roles: string[]) => hasAnyRole(user, roles),
      hasAllRoles: (roles: string[]) => hasAllRoles(user, roles),

      canAccessFeature: (feature: string) => canAccessFeature(user, feature),

      isAdmin: isAdmin(user),
      isOwner: isOwner(user),
      isSeller: isSeller(user),
      isClient: isClient(user),

      primaryRole: getPrimaryRole(user),
      roleDisplayName: getRoleDisplayName(getPrimaryRole(user) || ''),
      roleColor: getRoleColor(getPrimaryRole(user) || ''),

      canManageUser: (targetUser: any) => canManageUser(user, targetUser),
      canAssignRole: (role: string) => canAssignRole(user, role),
      canRemoveRole: (role: string) => canRemoveRole(user, role),

      availableRoles: getAvailableRolesForAssignment(user),

      user,
      isAuthenticated,
      isInitialized
    }
  }, [user, isAuthenticated, isInitialized, authContext])

  return permissions
}

export function usePermissionCheck(permission: string) {
  const { hasPermission } = usePermissions()
  return hasPermission(permission)
}

export function usePermissionChecks(permissions: string[], requireAll = false) {
  const { hasAnyPermission, hasAllPermissions } = usePermissions()

  if (requireAll) {
    return hasAllPermissions(permissions)
  }

  return hasAnyPermission(permissions)
}

export function useRoleCheck(roles: string[], requireAll = false) {
  const { hasAnyRole, hasAllRoles } = usePermissions()

  if (requireAll) {
    return hasAllRoles(roles)
  }

  return hasAnyRole(roles)
}

export function useFeatureAccess(feature: string) {
  const { canAccessFeature } = usePermissions()
  return canAccessFeature(feature)
}

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

function getAvailableRolesForAssignment(user: any): string[] {
  if (!user) return []

  if (isOwner(user) || isAdmin(user)) {
    return ['manager', 'seller', 'client']
  }

  return []
}
