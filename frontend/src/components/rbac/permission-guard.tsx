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

  if (!isInitialized && showLoading) {
    return <Spinner fullscreen size="lg" message={loadingMessage} />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (feature) {
    if (!canAccessFeature(user, feature)) {
      return <Navigate to={fallbackPath} replace />
    }
  }

  if (permission) {
    if (!hasPermission(user, permission)) {
      return <Navigate to={fallbackPath} replace />
    }
  }

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

  if (feature && !canAccessFeature(user, feature)) {
    return <>{fallback}</>
  }

  if (permission && !hasPermission(user, permission)) {
    return <>{fallback}</>
  }

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
