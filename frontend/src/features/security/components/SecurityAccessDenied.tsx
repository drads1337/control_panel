import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Shield } from 'lucide-react'

interface SecurityAccessDeniedProps {
  message: string
}

export function SecurityAccessDenied({ message }: SecurityAccessDeniedProps) {
  return (
    <div className="container mx-auto p-4 sm:p-6">
      <Card className="@container/card">
        <CardContent className="p-4 sm:p-6">
          <div className="text-center">
            <Shield className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-sm sm:text-base text-muted-foreground">{message}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

