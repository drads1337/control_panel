import React from 'react'
import { AlertCircle } from 'lucide-react'

interface RemoteControlErrorStateProps {
  error: string | null
}

export function RemoteControlErrorState({ error }: RemoteControlErrorStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] px-4">
      <div className="text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Error Loading Remote Control</h2>
        <p className="text-sm text-muted-foreground">
          {error || 'An unexpected error occurred'}
        </p>
      </div>
    </div>
  )
}

