import React from 'react'
import type { User } from '@/entities/user'

interface ManagementAccessDeniedProps {
  isAuthenticated: boolean
  hasAccess: boolean
  user: User | null | undefined
}

export function ManagementAccessDenied({
  isAuthenticated,
  hasAccess,
  user,
}: ManagementAccessDeniedProps) {
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You need to be logged in to access the management panel.
          </p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    const userPermissions = user?.permissions || []
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to access the management panel.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Your roles: {user?.roles?.join(', ') || 'unknown'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Your permissions ({userPermissions.length}):{' '}
            {userPermissions.length > 0
              ? userPermissions.slice(0, 10).join(', ') +
                (userPermissions.length > 10 ? '...' : '')
              : 'none (using role-based mapping)'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Required permissions: any permission starting with keys.*, games.files_*,
            games.*, or loaders.*
          </p>
        </div>
      </div>
    )
  }

  return null
}
