import React from 'react'
import { usePermissions } from '@/lib/hooks'

// SECURITY WARNING: This component provides UX-only permission-based rendering
// It does NOT provide security - attackers can bypass this by modifying client code
// All permission checks MUST be duplicated on the backend for each API endpoint
// This component is purely for user experience - showing/hiding UI elements

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

  if (!isInitialized && showLoading) {
    return <>{loadingComponent || <div>Loading...</div>}</>
  }

  if (feature && !canAccessFeature(feature)) {
    return <>{fallback}</>
  }

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>
  }

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

  if (feature) {
    hasAccess = canAccessFeature(feature)
  }

  if (permission) {
    hasAccess = hasPermission(permission)
  }

  if (permissions && permissions.length > 0) {
    if (requireAll) {
      hasAccess = hasAllPermissions(permissions)
    } else {
      hasAccess = hasAnyPermission(permissions)
    }
  }

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

  if (feature) {
    hasAccess = canAccessFeature(feature)
  }

  if (permission) {
    hasAccess = hasPermission(permission)
  }

  if (permissions && permissions.length > 0) {
    if (requireAll) {
      hasAccess = hasAllPermissions(permissions)
    } else {
      hasAccess = hasAnyPermission(permissions)
    }
  }

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
