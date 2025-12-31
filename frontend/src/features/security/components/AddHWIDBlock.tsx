import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render'

interface AddHWIDBlockProps {
  onAdd: (data: {
    hwid: string
    reason: string
    expires_at?: string
    block_type: string
    category: string
    severity: string
    threat_score: number
  }) => void
  loading?: boolean
}

export default function AddHWIDBlock({ onAdd, loading = false }: AddHWIDBlockProps) {
  const handleAdd = () => {
    // Simple implementation - can be enhanced with a dialog later
    const hwid = prompt('Enter Hardware ID:')
    if (!hwid) return
    
    const reason = prompt('Enter reason:')
    if (!reason) return

    onAdd({
      hwid: hwid,
      reason: reason,
      block_type: 'manual',
      category: 'general',
      severity: 'medium',
      threat_score: 50
    })
  }

  return (
    <ConditionalRender permission="security.block_hwids" fallback={null}>
      <Button 
        size="sm" 
        onClick={handleAdd}
        disabled={loading}
        className="h-9 sm:h-8"
      >
        <Plus className="h-4 w-4 mr-2" />
        Block HWID
      </Button>
    </ConditionalRender>
  )
}

