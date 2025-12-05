import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export function RemoteControlAccessDenied() {
  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 px-2 xs:px-3 sm:px-4 md:px-0">
      <div className="mb-3 xs:mb-4 sm:mb-5 md:mb-6">
        <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
          Remote Control
        </h1>
        <p className="text-xs xs:text-sm sm:text-sm md:text-base text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
          Manage remote control features for clients
        </p>
      </div>
      <Card>
        <CardContent className="p-4 xs:p-5 sm:p-6">
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <Settings className="h-10 w-10 xs:h-12 xs:w-12 text-muted-foreground mx-auto mb-3 xs:mb-4" />
              <h2 className="text-sm xs:text-base font-semibold mb-2">Access Denied</h2>
              <p className="text-xs xs:text-sm text-muted-foreground mt-1">
                You don't have permission to access remote control features.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
