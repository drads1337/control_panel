import React from 'react'
import { Key, Database, FolderOpen, Zap } from 'lucide-react'
import { ManagementStatCard } from './management-stat-card'
import type { ManagementStats } from '@/hooks/use-management-stats'

interface ManagementStatsCardsProps {
  stats: ManagementStats
  loading: boolean
}

export function ManagementStatsCards({ stats, loading }: ManagementStatsCardsProps) {
  return (
    <div
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3 md:gap-4 lg:gap-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
    >
      <ManagementStatCard
        permission="keys.view"
        title="License Keys"
        value={stats.totalKeys}
        icon={Key}
        badge={{
          text: `${stats.activeKeys} active`,
          icon: Key,
        }}
        footer={{
          description: 'Key management system',
          icon: Key,
          details: `${stats.expiredKeys} expired keys`,
        }}
        loading={loading}
      />

      <ManagementStatCard
        permission="products.view"
        title="Products"
        value={stats.totalProducts}
        icon={Database}
        badge={{
          text: 'in database',
          icon: Database,
        }}
        footer={{
          description: 'Product catalog management',
          icon: Database,
          details: 'Total products in the database',
        }}
        loading={loading}
      />

      <ManagementStatCard
        permission="products.files_view"
        title="Files"
        value={stats.totalFiles}
        icon={FolderOpen}
        badge={{
          text: 'total files',
          icon: FolderOpen,
        }}
        footer={{
          description: 'File management system',
          icon: FolderOpen,
          details: 'Total files in the system',
        }}
        loading={loading}
      />

      <ManagementStatCard
        permission="agents.view"
        title="Agents"
        value={stats.totalAgents}
        icon={Zap}
        badge={{
          text: 'total agents',
          icon: Zap,
        }}
        footer={{
          description: 'Agent management system',
          icon: Zap,
          details: 'Total agents available',
        }}
        loading={loading}
      />
    </div>
  )
}
