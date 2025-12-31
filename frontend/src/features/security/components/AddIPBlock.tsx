import React from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render'

interface AddIPBlockProps {
  onAdd: (data: {
    ip_address: string
    reason: string
    expires_at?: string
    block_type: string
    category: string
    severity: string
    threat_score: number
  }) => void
  loading?: boolean
}

export default function AddIPBlock({ onAdd, loading = false }: AddIPBlockProps) {
  const handleAdd = () => {
    // Simple implementation - can be enhanced with a dialog later
    const ip = prompt('Enter IP address:')
    if (!ip) return
    
    const reason = prompt('Enter reason:')
    if (!reason) return

    onAdd({
      ip_address: ip,
      reason: reason,
      block_type: 'manual',
      category: 'general',
      severity: 'medium',
      threat_score: 50
    })
  }

  return (
    <ConditionalRender permission="security.block_ips" fallback={null}>
      <Button 
        size="sm" 
        onClick={handleAdd}
        disabled={loading}
        className="h-9 sm:h-8"
      >
        <Plus className="h-4 w-4 mr-2" />
        Block IP
      </Button>
    </ConditionalRender>
  )
}