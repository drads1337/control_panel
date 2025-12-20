import React from 'react'
import AddBlockDialog, { type BlockFormData } from './AddBlockDialog'
import { useBlockDialogConfig } from './hooks/useBlockDialogConfig'

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
  const config = useBlockDialogConfig('hwid')

  const handleAdd = (data: BlockFormData) => {
    onAdd({
      hwid: data.hwid as string,
      reason: data.reason as string,
      expires_at: data.expires_at as string | undefined,
      block_type: data.block_type as string,
      category: data.category as string,
      severity: data.severity as string,
      threat_score: data.threat_score as number
    })
  }

  return (
    <AddBlockDialog
      config={config}
      onAdd={handleAdd}
      loading={loading}
    />
  )
}