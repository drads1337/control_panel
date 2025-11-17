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
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}
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
        permission="games.view"
        title="Games"
        value={stats.totalGames}
        icon={Database}
        badge={{
          text: 'in database',
          icon: Database,
        }}
        footer={{
          description: 'Application catalog management',
          icon: Database,
          details: 'Total applications in the database',
        }}
        loading={loading}
      />

      <ManagementStatCard
        permission="games.files_view"
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
        permission="loaders.view"
        title="Loaders"
        value={stats.totalLoaders}
        icon={Zap}
        badge={{
          text: 'total loaders',
          icon: Zap,
        }}
        footer={{
          description: 'Loader management system',
          icon: Zap,
          details: 'Total loaders available',
        }}
        loading={loading}
      />
    </div>
  )
}

