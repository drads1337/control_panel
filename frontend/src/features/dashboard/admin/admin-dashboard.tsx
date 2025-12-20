import React, { Suspense } from 'react'
import { useDashboardStats, DashboardData } from '@/features/dashboard/hooks/use-dashboard-stats'
import { LoadingState } from '../loading-state'
import { ErrorState } from '../error-state'
import { StatCardsGrid } from '../stat-cards-grid'
import { usePermissions } from '@/lib/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

const ChartAreaInteractive = React.lazy(() => import('../chart-area-interactive').then(module => ({ default: module.ChartAreaInteractive })))
const CountriesMap = React.lazy(() => import('../countries-map').then(module => ({ default: module.CountriesMap })))
const DataTable = React.lazy(() => import('./data-table').then(module => ({ default: module.DataTable })))

export function AdminDashboard() {
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
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading map..." /></div>}>
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              Requests by Country
            </CardTitle>
            <CardDescription className="text-sm">
              Geographic distribution of API requests
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <CountriesMap data={data} height={400} />
          </CardContent>
        </Card>
      </Suspense>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading data table..." /></div>}>
        <DataTable 
          data={(data as DashboardData)?.top_products || []} 
          announcements={(data as DashboardData)?.announcements || []}
          topUsers={(data as DashboardData)?.top_users || []}
        />
      </Suspense>
    </div>
  )
}

