import React from 'react'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw } from 'lucide-react'

interface WebhooksPageHeaderProps {
  canCreate: boolean
  onCreateClick: () => void
  onRefresh: () => void
  loading: boolean
  refreshing: boolean
}

export function WebhooksPageHeader({
  canCreate,
  onCreateClick,
  onRefresh,
  loading,
  refreshing
}: WebhooksPageHeaderProps) {
  return (
    <div className="mb-3 xs:mb-4 sm:mb-5 md:mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
            Webhooks
          </h1>
          <p className="text-xs xs:text-sm sm:text-sm md:text-base text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
            Configure webhooks to receive real-time notifications about events in your system.
          </p>
          {canCreate && (
            <div className="mt-2 xs:mt-2.5 sm:mt-3 hidden sm:block">
              <Button onClick={onCreateClick}>
                <Plus className="h-4 w-4 mr-2" />
                Create Webhook
              </Button>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading || refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  )
}
