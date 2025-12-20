import React from 'react'
import { Spinner } from '@/components/ui/spinner'
import { useManagementStats } from '@/features/user-administration/hooks/use-management-stats'
import { useManagementData } from '@/features/user-administration/hooks/use-management-data'
import { ManagementStatsCards } from './management-stats-cards'
import { ManagementTabs } from './management-tabs'

export function ManagementPageContent() {
  const { stats, isLoading: loadingStats } = useManagementStats()
  const { availableTabs } = useManagementData()

  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
      {}
      {loadingStats && (
        <div className="flex items-center justify-center p-3 xs:p-4 sm:p-6 md:p-8">
          <Spinner message="Loading management data..." />
        </div>
      )}

      {}
      <ManagementStatsCards stats={stats} loading={loadingStats} />

      {}
      <ManagementTabs availableTabs={availableTabs} />
    </div>
  )
}
