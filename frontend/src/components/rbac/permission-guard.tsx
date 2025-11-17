import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '@/contexts/auth-context'
import { hasPermission, hasAnyRole, hasAllRoles, canAccessFeature } from '@/lib/rbac-utils'
import { Spinner } from '@/components/ui/spinner'

interface PermissionGuardProps {
  children: React.ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  roles?: string[]
  requireAnyRole?: boolean
  feature?: string
  fallbackPath?: string
  showLoading?: boolean
  loadingMessage?: string
}

/**
 * Permission Guard Component
 * Protects content based on user permissions, roles, or features
 * 
 * ⚠️ SECURITY WARNING: This component provides UX-level protection only.
 * It redirects unauthorized users but does NOT prevent API access. A determined user can:
 * - Bypass these checks by calling APIs directly
 * - Inspect network requests and modify them
 * - Use browser dev tools to manipulate the UI
 * 
 * CRITICAL: Backend must validate ALL permissions on EVERY API endpoint.
 * Backend is the single source of truth for security. This component is for UX only.
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  requireAll = false,
  roles,
  requireAnyRole = true,
  feature,
  fallbackPath = '/dashboard',
  showLoading = true,
  loadingMessage = 'Checking permissions...'
}: PermissionGuardProps) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()

  // Show loading while authentication is initializing
  if (!isInitialized && showLoading) {
    return <Spinner fullscreen size="lg" message={loadingMessage} />
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  // Check feature access
  if (feature) {
    if (!canAccessFeature(user, feature)) {
      return <Navigate to={fallbackPath} replace />
    }
  }

  // Check single permission
  if (permission) {
    if (!hasPermission(user, permission)) {
      return <Navigate to={fallbackPath} replace />
    }
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    if (requireAll) {
      if (!hasAllRoles(user, permissions)) {
        return <Navigate to={fallbackPath} replace />
      }
    } else {
      if (!hasAnyRole(user, permissions)) {
        return <Navigate to={fallbackPath} replace />
      }
    }
  }

  // Check roles
  if (roles && roles.length > 0) {
    if (requireAnyRole) {
      if (!hasAnyRole(user, roles)) {
        return <Navigate to={fallbackPath} replace />
      }
    } else {
      if (!hasAllRoles(user, roles)) {
        return <Navigate to={fallbackPath} replace />
      }
    }
  }

  return <>{children}</>
}

/**
 * Higher-Order Component for permission-based route protection
 */
export function withPermissionGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: Omit<PermissionGuardProps, 'children'> = {}
) {
  const PermissionGuardedComponent = (props: P) => {
    return (
      <PermissionGuard {...options}>
        <WrappedComponent {...props} />
      </PermissionGuard>
    )
  }

  PermissionGuardedComponent.displayName = `withPermissionGuard(${WrappedComponent.displayName || WrappedComponent.name})`
  return PermissionGuardedComponent
}

/**
 * Conditional rendering component based on permissions
 */
export function ConditionalPermission({
  children,
  fallback = null,
  ...permissionProps
}: PermissionGuardProps & { fallback?: React.ReactNode }) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()

  if (!isInitialized || !isAuthenticated || !user) {
    return <>{fallback}</>
  }

  const {
    permission,
    permissions,
    requireAll = false,
    roles,
    requireAnyRole = true,
    feature
  } = permissionProps

  // Check feature access
  if (feature && !canAccessFeature(user, feature)) {
    return <>{fallback}</>
  }

  // Check single permission
  if (permission && !hasPermission(user, permission)) {
    return <>{fallback}</>
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    if (requireAll) {
      if (!hasAllRoles(user, permissions)) {
        return <>{fallback}</>
      }
    } else {
      if (!hasAnyRole(user, permissions)) {
        return <>{fallback}</>
      }
    }
  }

  // Check roles
  if (roles && roles.length > 0) {
    if (requireAnyRole) {
      if (!hasAnyRole(user, roles)) {
        return <>{fallback}</>
      }
    } else {
      if (!hasAllRoles(user, roles)) {
        return <>{fallback}</>
      }
    }
  }

  return <>{children}</>
}
