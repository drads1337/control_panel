import React from 'react'
import { Spinner } from '@/components/ui/spinner'
import { useManagementStats } from '@/hooks/use-management-stats'
import { useManagementData } from '@/hooks/use-management-data'
import { ManagementStatsCards } from './management-stats-cards'
import { ManagementTabs } from './management-tabs'

export function ManagementPageContent() {
  const { stats, isLoading: loadingStats } = useManagementStats()
  const { availableTabs } = useManagementData()

  return (
    <div className="space-y-6">
      {/* Loading indicator */}
      {loadingStats && (
        <div className="flex items-center justify-center p-8">
          <Spinner message="Loading management data..." />
        </div>
      )}

      {/* Stats Cards */}
      <ManagementStatsCards stats={stats} loading={loadingStats} />

      {/* Tabs Interface */}
      <ManagementTabs availableTabs={availableTabs} />
    </div>
  )
}

