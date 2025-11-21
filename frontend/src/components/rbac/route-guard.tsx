import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthContext } from '@/contexts/auth-context'
import { hasPermission, hasAnyRole, hasAllRoles, canAccessFeature, hasManagementAccess } from '@/lib/rbac-utils'
import { Spinner } from '@/components/ui/spinner'

// SECURITY WARNING: All route guards in this file provide UX-only protection
// They do NOT provide security - attackers can bypass these by calling APIs directly
// All permission checks MUST be duplicated on the backend for each API endpoint
// These components are purely for user experience - redirecting unauthorized users

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

  if (!isInitialized && showLoading) {
    return <Spinner fullscreen size="lg" message={loadingMessage} />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const redirectPath = redirectTo || fallbackPath

  const isOwner = hasAnyRole(user, ['owner'])
  const isAdmin = hasAnyRole(user, ['admin'])

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

  if (isOwner || isAdmin) {
    return <>{children}</>
  }

  if (feature) {
    if (!canAccessFeature(user, feature)) {
      return <Navigate to={redirectPath} replace />
    }
  }

  if (permission) {
    if (!hasPermission(user, permission)) {
      return <Navigate to={redirectPath} replace />
    }
  }

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

export function AdminRouteGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const location = useLocation()

  if (!isInitialized) {
    return <Spinner fullscreen size="lg" message="Checking admin access..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const isAdmin = hasAnyRole(user, ['admin', 'owner'])
  const { hasAccess: hasManagementPermissions } = hasManagementAccess(user)

  if (!isAdmin && !hasManagementPermissions) {
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}

export function ManagementPageGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const location = useLocation()

  if (!isInitialized) {
    return <Spinner fullscreen size="lg" message="Checking management access..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const { hasAccess } = hasManagementAccess(user)

  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}

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

export function UsersManagementGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const location = useLocation()

  if (!isInitialized) {
    return <Spinner fullscreen size="lg" message="Checking user management access..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const userPermissions = user.permissions || []

  if (userPermissions.length === 0) {

    return <Navigate to={fallbackPath} replace />
  }

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

export function ProductManagementGuard({ children, fallbackPath = '/dashboard' }: { children: React.ReactNode; fallbackPath?: string }) {
  return (
    <RouteGuard
      feature="product_management"
      fallbackPath={fallbackPath}
      loadingMessage="Checking product management access..."
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

  if (!isInitialized) {
    return <Spinner fullscreen size="lg" message="Checking remote control access..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const userPermissions = user.permissions || []

  if (userPermissions.length === 0) {

    return <Navigate to={fallbackPath} replace />
  }

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
