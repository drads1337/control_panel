import React from 'react'
import { usePermissions } from '@/hooks/use-permissions'

interface ConditionalRenderProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  roles?: string[]
  requireAnyRole?: boolean
  feature?: string
  showLoading?: boolean
  loadingComponent?: React.ReactNode
}

/**
 * Conditional Render Component
 * Renders children based on user permissions, roles, or features
 * Useful for showing/hiding UI elements
 * 
 * ⚠️ SECURITY WARNING: This component provides UX-level protection only.
 * It hides UI elements but does NOT prevent API access. A determined user can:
 * - Bypass these checks by calling APIs directly
 * - Inspect network requests and modify them
 * - Use browser dev tools to manipulate the UI
 * 
 * CRITICAL: Backend must validate ALL permissions on EVERY API endpoint.
 * Backend is the single source of truth for security. This component is for UX only.
 */
export function ConditionalRender({
  children,
  fallback = null,
  permission,
  permissions,
  requireAll = false,
  roles,
  requireAnyRole = true,
  feature,
  showLoading = false,
  loadingComponent
}: ConditionalRenderProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasAnyRole,
    hasAllRoles,
    canAccessFeature,
    isInitialized
  } = usePermissions()

  // Show loading if not initialized
  if (!isInitialized && showLoading) {
    return <>{loadingComponent || <div>Loading...</div>}</>
  }

  // Check feature access
  if (feature && !canAccessFeature(feature)) {
    return <>{fallback}</>
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    if (requireAll) {
      if (!hasAllPermissions(permissions)) {
        return <>{fallback}</>
      }
    } else {
      if (!hasAnyPermission(permissions)) {
        return <>{fallback}</>
      }
    }
  }

  // Check roles
  if (roles && roles.length > 0) {
    if (requireAnyRole) {
      if (!hasAnyRole(roles)) {
        return <>{fallback}</>
      }
    } else {
      if (!hasAllRoles(roles)) {
        return <>{fallback}</>
      }
    }
  }

  return <>{children}</>
}

/**
 * Permission-based button component
 * Disables button if user doesn't have required permissions
 */
export function PermissionButton({
  children,
  permission,
  permissions,
  requireAll = false,
  roles,
  requireAnyRole = true,
  feature,
  disabled,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  roles?: string[]
  requireAnyRole?: boolean
  feature?: string
}) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasAnyRole,
    hasAllRoles,
    canAccessFeature
  } = usePermissions()

  let hasAccess = true

  // Check feature access
  if (feature) {
    hasAccess = canAccessFeature(feature)
  }

  // Check single permission
  if (permission) {
    hasAccess = hasPermission(permission)
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    if (requireAll) {
      hasAccess = hasAllPermissions(permissions)
    } else {
      hasAccess = hasAnyPermission(permissions)
    }
  }

  // Check roles
  if (roles && roles.length > 0) {
    if (requireAnyRole) {
      hasAccess = hasAnyRole(roles)
    } else {
      hasAccess = hasAllRoles(roles)
    }
  }

  return (
    <button
      {...props}
      disabled={disabled || !hasAccess}
      onClick={hasAccess ? onClick : undefined}
      title={!hasAccess ? 'Insufficient permissions' : undefined}
    >
      {children}
    </button>
  )
}

/**
 * Permission-based link component
 * Disables link if user doesn't have required permissions
 */
export function PermissionLink({
  children,
  permission,
  permissions,
  requireAll = false,
  roles,
  requireAnyRole = true,
  feature,
  href,
  onClick,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  roles?: string[]
  requireAnyRole?: boolean
  feature?: string
}) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasAnyRole,
    hasAllRoles,
    canAccessFeature
  } = usePermissions()

  let hasAccess = true

  // Check feature access
  if (feature) {
    hasAccess = canAccessFeature(feature)
  }

  // Check single permission
  if (permission) {
    hasAccess = hasPermission(permission)
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    if (requireAll) {
      hasAccess = hasAllPermissions(permissions)
    } else {
      hasAccess = hasAnyPermission(permissions)
    }
  }

  // Check roles
  if (roles && roles.length > 0) {
    if (requireAnyRole) {
      hasAccess = hasAnyRole(roles)
    } else {
      hasAccess = hasAllRoles(roles)
    }
  }

  if (!hasAccess) {
    return (
      <span {...props} style={{ opacity: 0.5, cursor: 'not-allowed' }} title="Insufficient permissions">
        {children}
      </span>
    )
  }

  return (
    <a
      {...props}
      href={href}
      onClick={onClick}
    >
      {children}
    </a>
  )
}

/**
 * Role-based conditional render
 */
export function RoleRender({
  children,
  fallback = null,
  roles,
  requireAnyRole = true
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
  roles: string[]
  requireAnyRole?: boolean
}) {
  return (
    <ConditionalRender
      roles={roles}
      requireAnyRole={requireAnyRole}
      fallback={fallback}
    >
      {children}
    </ConditionalRender>
  )
}

/**
 * Admin-only render
 */
export function AdminRender({
  children,
  fallback = null
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleRender roles={['admin', 'owner']} fallback={fallback}>
      {children}
    </RoleRender>
  )
}

/**
 * Owner-only render
 */
export function OwnerRender({
  children,
  fallback = null
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleRender roles={['owner']} fallback={fallback}>
      {children}
    </RoleRender>
  )
}

/**
 * Seller or above render
 */
export function SellerRender({
  children,
  fallback = null
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleRender roles={['owner', 'admin', 'seller']} fallback={fallback}>
      {children}
    </RoleRender>
  )
}

/**
 * Developer or above render
 */
export function DeveloperRender({
  children,
  fallback = null
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleRender roles={['owner', 'admin', 'developer']} fallback={fallback}>
      {children}
    </RoleRender>
  )
}
