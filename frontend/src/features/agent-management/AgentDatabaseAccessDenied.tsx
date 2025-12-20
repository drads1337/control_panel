import React from 'react'
import { Card } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

export function AgentDatabaseAccessDenied() {
  return (
    <Card className="text-center p-6 sm:p-8">
      <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 text-red-500" />
      <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
      <p className="text-sm sm:text-base text-muted-foreground max-w-xs mx-auto">
        You don't have permission to view agents.
      </p>
    </Card>
  )
}

