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
      <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px] px-4">
        <div className="text-center max-w-md">
          <h2 className="text-lg sm:text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            You need to be logged in to access the management panel.
          </p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    // SECURITY: Do not leak information about user roles, permissions, or required permissions
    // This helps prevent attackers from understanding the RBAC model structure
    // Show only generic error message without details
    return (
      <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px] px-4">
        <div className="text-center max-w-md">
          <h2 className="text-lg sm:text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            You don't have permission to access the management panel.
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }

  return null
}

