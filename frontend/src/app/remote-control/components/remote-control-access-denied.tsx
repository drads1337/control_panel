import React from 'react'
import { ShieldX } from 'lucide-react'
import { useAuthContext } from '@/contexts/auth-context'

export function RemoteControlAccessDenied() {
  const { user } = useAuthContext()

  return (
    <div className="flex items-center justify-center min-h-[400px] px-4">
      <div className="text-center">
        <ShieldX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
        <p className="text-sm text-muted-foreground mb-4">
          You don't have permission to view remote control features.
        </p>
        <p className="text-xs text-muted-foreground">
          Your roles: {user?.roles?.join(', ') || 'unknown'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Required permission: remote_control.view
        </p>
      </div>
    </div>
  )
}

