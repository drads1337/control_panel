import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface RemoteControlErrorStateProps {
  error: string
  onRetry: () => void
}

export function RemoteControlErrorState({ error, onRetry }: RemoteControlErrorStateProps) {
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
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 xs:h-5 xs:w-5 text-destructive shrink-0" />
            <span className="text-xs xs:text-sm text-destructive">{error}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRetry}
              className="ml-auto h-8 w-8 xs:h-9 xs:w-9"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
