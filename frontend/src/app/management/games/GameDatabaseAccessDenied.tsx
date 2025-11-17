import React from 'react'
import { Card } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

export function GameDatabaseAccessDenied() {
  return (
    <Card className="text-center p-8">
      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
      <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
      <p className="text-muted-foreground">You don't have permission to view games.</p>
    </Card>
  )
}

