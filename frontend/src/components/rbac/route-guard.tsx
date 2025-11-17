import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthContext } from '@/contexts/auth-context'
import { hasPermission, hasAnyRole, hasAllRoles, canAccessFeature, hasManagementAccess } from '@/lib/rbac-utils'
import { Spinner } from '@/components/ui/spinner'

// Helper functions for checking multiple permissions
function hasAnyPermission(user: any, permissions: string[]): boolean {
  return permissions.some(permission => hasPermission(user, permission))
}

function hasAllPermissions(user: any, permissions: string[]): boolean {
  return permissions.every(permission => hasPermission(user, permission))
}

interface RouteGuardProps {
  children: React.ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  roles?: string[]
  requireAnyRole?: boolean
  feature?: string
  fallbackPath?: string
  redirectTo?: string
  showLoading?: boolean
  loadingMessage?: string
}

/**
 * Route Guard Component
 * Protects routes based on user permissions, roles, or features
 * Provides more granular control than PermissionGuard
 */
export function RouteGuard({
  children,
  permission,
  permissions,
  requireAll = false,
  roles,
  requireAnyRole = true,
  feature,
  fallbackPath = '/dashboard',
  redirectTo,
  showLoading = true,
  loadingMessage = 'Checking access...'
}: RouteGuardProps) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const location = useLocation()

  // Show loading while authentication is initializing
  if (!isInitialized && showLoading) {
    return <Spinner fullscreen size="lg" message={loadingMessage} />
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const redirectPath = redirectTo || fallbackPath

  // Owner and admin bypass permission and feature checks (unless explicitly restricted by roles)
  // Check if user is owner or admin
  const isOwner = hasAnyRole(user, ['owner'])
  const isAdmin = hasAnyRole(user, ['admin'])

  // Check roles first - this can restrict even owner/admin access for specific routes
  // (e.g., some routes might be owner-only even if owner has all permissions)
  if (roles && roles.length > 0) {
    if (requireAnyRole) {
      if (!hasAnyRole(user, roles)) {
        return <Navigate to={redirectPath} replace />
      }
    } else {
      if (!hasAllRoles(user, roles)) {
        return <Navigate to={redirectPath} replace />
      }
    }
  }

  // Owner and admin bypass feature/permission checks (after role check passes)
  if (isOwner || isAdmin) {
    return <>{children}</>
  }

  // Check feature access (only for non-owner/admin)
  if (feature) {
    if (!canAccessFeature(user, feature)) {
      return <Navigate to={redirectPath} replace />
    }
  }

  // Check single permission (only for non-owner/admin)
  if (permission) {
    if (!hasPermission(user, permission)) {
      return <Navigate to={redirectPath} replace />
    }
  }

  // Check multiple permissions (only for non-owner/admin)
  if (permissions && permissions.length > 0) {
    if (requireAll) {
      if (!hasAllPermissions(user, permissions)) {
        return <Navigate to={redirectPath} replace />
      }
    } else {
      if (!hasAnyPermission(user, permissions)) {
        return <Navigate to={redirectPath} replace />
      }
    }
  }

  return <>{children}</>
}

/**
 * Admin Route Guard - requires admin or owner role OR permissions
 */
export function AdminRouteGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const location = useLocation()

  // Show loading while authentication is initializing
  if (!isInitialized) {
    return <Spinner fullscreen size="lg" message="Checking admin access..." />
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check if user has admin/owner role OR has management permissions
  // Use centralized permission check - only checks actual permissions from backend
  const isAdmin = hasAnyRole(user, ['admin', 'owner'])
  const { hasAccess: hasManagementPermissions } = hasManagementAccess(user)

  if (!isAdmin && !hasManagementPermissions) {
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}

/**
 * Management Page Guard - requires any keys.* OR files.* OR games.* OR loaders.* permission
 * This matches the sidebar logic which checks for permission prefixes
 * 
 * SECURITY: Uses hasManagementAccess() which only checks actual permissions from backend.
 * Never guesses or constructs permission names.
 */
export function ManagementPageGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const location = useLocation()

  // Show loading while authentication is initializing
  if (!isInitialized) {
    return <Spinner fullscreen size="lg" message="Checking management access..." />
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Use centralized permission check - only checks actual permissions from backend
  const { hasAccess } = hasManagementAccess(user)

  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}

/**
 * Owner Route Guard - requires owner role
 */
export function OwnerRouteGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      roles={['owner']}
      fallbackPath={fallbackPath}
      loadingMessage="Checking owner access..."
    >
      {children}
    </RouteGuard>
  )
}

/**
 * Seller Route Guard - requires seller role or higher
 */
export function SellerRouteGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      roles={['owner', 'admin', 'seller']}
      fallbackPath={fallbackPath}
      loadingMessage="Checking seller access..."
    >
      {children}
    </RouteGuard>
  )
}

/**
 * Developer Route Guard - requires developer role or higher
 */
export function DeveloperRouteGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      roles={['owner', 'admin', 'developer']}
      fallbackPath={fallbackPath}
      loadingMessage="Checking developer access..."
    >
      {children}
    </RouteGuard>
  )
}

/**
 * Support Route Guard - requires support role or higher
 */
export function SupportRouteGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      roles={['owner', 'admin', 'support']}
      fallbackPath={fallbackPath}
      loadingMessage="Checking support access..."
    >
      {children}
    </RouteGuard>
  )
}

/**
 * Feature-based Route Guards
 */
export function UsersManagementGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const location = useLocation()

  // Show loading while authentication is initializing
  if (!isInitialized) {
    return <Spinner fullscreen size="lg" message="Checking user management access..." />
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check if user has users.*, employees.* or clients.* permissions
  // Backend is the single source of truth - if admin/owner should have access, 
  // backend must send the corresponding permissions
  const userPermissions = user.permissions || []
  
  // CRITICAL: Only check actual permissions from backend
  // If user.permissions is empty, return false (fail-safe approach)
  if (userPermissions.length === 0) {
    console.warn('🔒 UsersManagementGuard: user.permissions is empty, denying access', {
      user_id: user.id,
      roles: user.roles
    })
    return <Navigate to={fallbackPath} replace />
  }
  
  // Check permissions by prefix (never guess or construct permission names)
  const hasAccess = userPermissions.some(perm => 
    perm.startsWith('users.') || 
    perm.startsWith('employees.') || 
    perm.startsWith('clients.')
  )

  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}

export function RBACManagementGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      feature="rbac_management"
      fallbackPath={fallbackPath}
      loadingMessage="Checking RBAC management access..."
    >
      {children}
    </RouteGuard>
  )
}

export function ProjectSettingsGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      feature="project_settings"
      fallbackPath={fallbackPath}
      loadingMessage="Checking project settings access..."
    >
      {children}
    </RouteGuard>
  )
}

export function KeyManagementGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      feature="key_management"
      fallbackPath={fallbackPath}
      loadingMessage="Checking key management access..."
    >
      {children}
    </RouteGuard>
  )
}

export function GameManagementGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      feature="game_management"
      fallbackPath={fallbackPath}
      loadingMessage="Checking game management access..."
    >
      {children}
    </RouteGuard>
  )
}

export function AnalyticsGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      feature="analytics_view"
      fallbackPath={fallbackPath}
      loadingMessage="Checking analytics access..."
    >
      {children}
    </RouteGuard>
  )
}

export function FileManagementGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      feature="file_management"
      fallbackPath={fallbackPath}
      loadingMessage="Checking file management access..."
    >
      {children}
    </RouteGuard>
  )
}

export function RemoteControlGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const location = useLocation()

  // Show loading while authentication is initializing
  if (!isInitialized) {
    return <Spinner fullscreen size="lg" message="Checking remote control access..." />
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check if user has remote_control.* permissions
  // Backend is the single source of truth - if admin/owner should have access, 
  // backend must send the corresponding permissions
  const userPermissions = user.permissions || []
  
  // CRITICAL: Only check actual permissions from backend
  // If user.permissions is empty, return false (fail-safe approach)
  if (userPermissions.length === 0) {
    console.warn('🔒 RemoteControlGuard: user.permissions is empty, denying access', {
      user_id: user.id,
      roles: user.roles
    })
    return <Navigate to={fallbackPath} replace />
  }
  
  // Check permissions by prefix (never guess or construct permission names)
  const hasAccess = userPermissions.some(perm => perm.startsWith('remote_control.'))

  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}

export function WebhooksGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      feature="webhook_management"
      fallbackPath={fallbackPath}
      loadingMessage="Checking webhook management access..."
    >
      {children}
    </RouteGuard>
  )
}

export function ProjectsGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      roles={['owner']}
      fallbackPath={fallbackPath}
      loadingMessage="Checking owner access..."
    >
      {children}
    </RouteGuard>
  )
}

export function ServersGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      feature="server_management"
      fallbackPath={fallbackPath}
      loadingMessage="Checking server access..."
    >
      {children}
    </RouteGuard>
  )
}

/**
 * Logs Route Guard - requires logs.view permission
 */
export function LogsGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      permission="logs.view"
      fallbackPath={fallbackPath}
      loadingMessage="Checking logs access..."
    >
      {children}
    </RouteGuard>
  )
}
