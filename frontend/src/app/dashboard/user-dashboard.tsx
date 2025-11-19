import React, { Suspense } from 'react'
import { useDashboardStats, DashboardData } from '@/hooks/use-dashboard-stats'
import { LoadingState } from './loading-state'
import { ErrorState } from './error-state'
import { StatCardsGrid } from './stat-cards-grid'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

const ChartAreaInteractive = React.lazy(() => import('./chart-area-interactive').then(module => ({ default: module.ChartAreaInteractive })))
const DataTable = React.lazy(() => import('./data-table').then(module => ({ default: module.DataTable })))

export function UserDashboard() {
  const { data, loading, error, refetch } = useDashboardStats()
  const { hasPermission } = usePermissions()

  const canViewAnalytics = hasPermission('analytics.view')

  if (!canViewAnalytics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-6">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You don't have permission to view analytics and dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return <LoadingState message="Loading your dashboard..." />
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <StatCardsGrid data={data} type="dashboard" />
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading charts..." /></div>}>
        <ChartAreaInteractive />
      </Suspense>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading data table..." /></div>}>
        <DataTable 
          data={(data as DashboardData)?.top_games || []} 
          announcements={(data as DashboardData)?.announcements || []}
          topUsers={(data as DashboardData)?.top_users || []}
        />
      </Suspense>
    </div>
  )
}
