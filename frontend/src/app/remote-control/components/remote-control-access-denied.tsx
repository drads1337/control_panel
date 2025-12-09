import React from 'react'
import { Card, CardContent } from '@/components/ui/card'

export default function RemoteControlAccessDenied() {
  return (
    <div className="space-y-4 px-2 xs:px-3 sm:px-4 md:px-0">
      <div className="mb-4">
        <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
          Remote Control
        </h1>
        <p className="text-xs xs:text-sm sm:text-sm md:text-base text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
          Manage remote control features for clients
        </p>
      </div>
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <h2 className="text-sm font-semibold mb-2">Access Denied</h2>
              <p className="text-sm text-muted-foreground">
                You don't have permission to access remote control features.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
