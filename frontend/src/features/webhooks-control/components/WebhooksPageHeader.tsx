import React from 'react'

export function WebhooksPageHeader() {
  return (
    <div>
      <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
        Webhooks
      </h1>
      <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
        Configure webhooks to receive real-time notifications about events in your system.
      </p>
    </div>
  )
}