import React from 'react'
import { Separator } from '@/shared/ui/components/separator'

export function Footer() {
  return (
    <div className="relative flex justify-between items-center pt-6 pb-2 text-[10px] text-text-secondary-dark mt-8 uppercase tracking-widest opacity-60">
      <Separator className="absolute top-0 left-0 right-0 border-border-dark" />
      <p>© 2025 SAAS MGR</p>
      <p className="font-mono-numbers">V.1.0.0-BETA</p>
    </div>
  )
}

