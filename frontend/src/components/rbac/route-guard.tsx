import React, { useEffect, useState } from 'react'
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
  const [permissionsLoadTimeout, setPermissionsLoadTimeout] = useState(false)

  // Detailed logging for logs permission
  const isLogsPermission = permission === 'logs.view'
  if (import.meta.env.DEV && isLogsPermission) {
    console.log('[RouteGuard] Initial state:', {
      pathname: location.pathname,
      isInitialized,
      isAuthenticated,
      hasUser: !!user,
      userRoles: user?.roles,
      userPermissions: user?.permissions,
      permission,
      permissions,
      feature,
      roles
    })
  }

  if (!isInitialized && showLoading) {
    if (isLogsPermission && import.meta.env.DEV) {
      console.log('[RouteGuard] Waiting for initialization...')
    }
    return <Spinner fullscreen size="lg" message={loadingMessage} />
  }

  if (!isAuthenticated || !user) {
    if (isLogsPermission && import.meta.env.DEV) {
      console.log('[RouteGuard] Not authenticated, redirecting to login')
    }
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const redirectPath = redirectTo || fallbackPath

  const isOwner = hasAnyRole(user, ['owner'])
  const isAdmin = hasAnyRole(user, ['admin'])

  if (isLogsPermission && import.meta.env.DEV) {
    console.log('[RouteGuard] Role check:', {
      isOwner,
      isAdmin,
      userRoles: user.roles
    })
  }

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

  // Owner and admin have access to everything
  if (isOwner || isAdmin) {
    if (isLogsPermission && import.meta.env.DEV) {
      console.log('[RouteGuard] Owner/Admin access granted, allowing access')
    }
    return <>{children}</>
  }

  // If we need to check permissions or features, but user permissions are not loaded yet,
  // wait for them to load before making a decision
  const needsPermissionCheck = !!(permission || permissions || feature)
  
  // If we need to check permissions but they're not loaded yet, show loading
  // This prevents premature redirects when permissions are still being fetched
  // Check if permissions array exists but is empty vs not loaded yet
  // If user object exists but permissions is undefined/null, it might still be loading
  // Also, if permissions is an empty array and user has roles, it might mean permissions are still loading
  const permissionsNotLoaded = user.permissions === undefined || user.permissions === null
  const permissionsEmpty = Array.isArray(user.permissions) && user.permissions.length === 0
  const hasRoles = user.roles && user.roles.length > 0
  
  if (isLogsPermission && import.meta.env.DEV) {
    console.log('[RouteGuard] Permission loading state:', {
      needsPermissionCheck,
      permissionsNotLoaded,
      permissionsEmpty,
      hasRoles,
      permissionsLoadTimeout,
      permissionsArray: user.permissions
    })
  }
  
  // Give permissions time to load if they're empty but user has roles
  useEffect(() => {
    if (needsPermissionCheck && permissionsEmpty && hasRoles && !permissionsNotLoaded) {
      if (isLogsPermission && import.meta.env.DEV) {
        console.log('[RouteGuard] Starting timeout for permissions load (2s)')
      }
      const timer = setTimeout(() => {
        if (isLogsPermission && import.meta.env.DEV) {
          console.log('[RouteGuard] Permissions load timeout expired')
        }
        setPermissionsLoadTimeout(true)
      }, 2000) // Wait 2 seconds for permissions to load
      return () => clearTimeout(timer)
    }
  }, [needsPermissionCheck, permissionsEmpty, hasRoles, permissionsNotLoaded, isLogsPermission])
  
  // If permissions are not loaded or empty (and user has roles which suggests permissions should exist),
  // wait a bit before making a decision
  if (needsPermissionCheck && (permissionsNotLoaded || (permissionsEmpty && hasRoles && !permissionsLoadTimeout))) {
    if (isLogsPermission && import.meta.env.DEV) {
      console.log('[RouteGuard] Showing loading spinner, waiting for permissions...')
    }
    if (showLoading) {
      return <Spinner fullscreen size="lg" message={loadingMessage} />
    }
    // If showLoading is false, don't redirect yet - wait for permissions to load
    // This prevents redirecting when permissions are still being fetched
    return null
  }

  if (feature) {
    if (!canAccessFeature(user, feature)) {
      return <Navigate to={redirectPath} replace />
    }
  }

  if (permission) {
    const hasPerm = hasPermission(user, permission)
    
    // Debug logging for logs.view permission
    if (import.meta.env.DEV && isLogsPermission) {
      // Check if user has any logs.* permissions
      const logsPermissions = user.permissions?.filter((p: string) => p.startsWith('logs.')) || []
      const hasWildcard = user.permissions?.includes('*') || false
      const hasLogsWildcard = user.permissions?.includes('logs.*') || false
      
      // Check all permissions that start with "logs"
      const allLogsRelated = user.permissions?.filter((p: string) => 
        typeof p === 'string' && (p.startsWith('logs') || p.includes('log'))
      ) || []
      
      console.log('[RouteGuard] Permission check result:', {
        permission,
        hasPermission: hasPerm,
        userPermissions: user.permissions,
        userPermissionsCount: user.permissions?.length || 0,
        logsPermissions,
        allLogsRelated,
        hasWildcard,
        hasLogsWildcard,
        userRoles: user.roles,
        isOwner,
        isAdmin,
        redirectPath,
        permissionsNotLoaded,
        permissionsEmpty,
        hasRoles,
        permissionsLoadTimeout,
        willRedirect: !hasPerm
      })
      
      // Log ALL permissions to see what user has
      if (user.permissions && user.permissions.length > 0) {
        console.log('[RouteGuard] ALL user permissions:', user.permissions)
        console.log('[RouteGuard] Permissions that contain "log":', user.permissions.filter((p: string) => typeof p === 'string' && p.toLowerCase().includes('log')))
      }
    }
    
    // If permission check fails, redirect only if we're sure permissions are loaded
    // Don't redirect if permissions might still be loading
    if (!hasPerm) {
      // If permissions are empty but user has roles, it might mean permissions are still loading
      // Wait a bit before redirecting
      if (permissionsEmpty && hasRoles && !permissionsNotLoaded) {
        if (isLogsPermission && import.meta.env.DEV) {
          console.log('[RouteGuard] Permissions empty but has roles, showing loading instead of redirecting')
        }
        // Give permissions a chance to load - show loading instead of redirecting immediately
        if (showLoading) {
          return <Spinner fullscreen size="lg" message={loadingMessage} />
        }
        return null
      }
      
      if (isLogsPermission && import.meta.env.DEV) {
        console.log('[RouteGuard] Permission denied, redirecting to:', redirectPath)
      }
      return <Navigate to={redirectPath} replace />
    }
    
    if (isLogsPermission && import.meta.env.DEV) {
      console.log('[RouteGuard] Permission granted, allowing access')
    }
  }

  if (permissions && permissions.length > 0) {
    if (requireAll) {
      if (!hasAllPermissions(user, permissions)) {
        if (isLogsPermission && import.meta.env.DEV) {
          console.log('[RouteGuard] Not all permissions granted, redirecting')
        }
        return <Navigate to={redirectPath} replace />
      }
    } else {
      if (!hasAnyPermission(user, permissions)) {
        if (isLogsPermission && import.meta.env.DEV) {
          console.log('[RouteGuard] No permissions granted, redirecting')
        }
        return <Navigate to={redirectPath} replace />
      }
    }
  }

  if (isLogsPermission && import.meta.env.DEV) {
    console.log('[RouteGuard] All checks passed, rendering children')
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

  // Admin and owner have access (checked in hasManagementAccess)
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

  // Admin and owner have access to user management
  const isAdmin = hasAnyRole(user, ['admin', 'owner'])
  if (isAdmin) {
    return <>{children}</>
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
      permission="analytics.view"
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

  // Admin and owner have access to remote control
  const isAdmin = hasAnyRole(user, ['admin', 'owner'])
  if (isAdmin) {
    return <>{children}</>
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
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const location = useLocation()
  
  if (!isInitialized) {
    return <Spinner fullscreen size="lg" message="Checking logs access..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const isOwner = hasAnyRole(user, ['owner'])
  const isAdmin = hasAnyRole(user, ['admin'])

  // Owner and admin have access to everything
  if (isOwner || isAdmin) {
    return <>{children}</>
  }

  // Check if user has logs.view permission (exact or via wildcard)
  const hasLogsView = hasPermission(user, 'logs.view')
  
  // Also check if user has any permission starting with "logs." (like navigation does)
  // This matches the backend navigation config which uses permissionPrefixes: ["logs."]
  const userPermissions = user.permissions || []
  const hasLogsPrefix = userPermissions.some((perm: string) => 
    typeof perm === 'string' && perm.startsWith('logs.')
  )

  // TEMPORARY: Also check if user has any log-related permissions
  // This is a workaround - ideally user should have logs.view or logs.* permission
  // Check for permissions that contain "log" and might grant access to logs page
  const hasAnyLogPermission = userPermissions.some((perm: string) => {
    if (typeof perm !== 'string') return false
    const permLower = perm.toLowerCase()
    // Check for webhooks.view_logs, security.view_logs, or any permission ending with .view_logs
    return permLower.includes('view_logs') || permLower === 'logs.view' || permLower.startsWith('logs.')
  })

  if (import.meta.env.DEV) {
    console.log('[LogsGuard] Access check:', {
      hasLogsView,
      hasLogsPrefix,
      hasAnyLogPermission,
      userPermissions: userPermissions.filter((p: string) => typeof p === 'string' && p.includes('log')),
      allPermissions: userPermissions
    })
  }

  // Grant access if user has logs.view, logs.*, or any log-related permission
  // NOTE: This is a temporary workaround - users should have logs.view or logs.* permission
  if (hasLogsView || hasLogsPrefix || hasAnyLogPermission) {
    return <>{children}</>
  }

  if (import.meta.env.DEV) {
    console.log('[LogsGuard] Access denied, redirecting to:', fallbackPath)
  }

  return <Navigate to={fallbackPath} replace />
}
