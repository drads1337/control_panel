import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface RemoteControlErrorStateProps {
  error: string
  onRetry: () => void
}

export default function RemoteControlErrorState({ error, onRetry }: RemoteControlErrorStateProps) {
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRetry}
              className="h-9 w-9"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
