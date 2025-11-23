import React from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useCallback, Suspense } from 'react'
import { LoadingState } from './loading-state'
import { ErrorState } from './error-state'
import { StatCardsGrid } from './stat-cards-grid'
import { useDashboardStats, DashboardData } from '@/hooks/use-dashboard-stats'
import { useOwnerDashboard, OwnerDashboardStats } from '@/hooks/use-owner-dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, BarChart3 } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { SlowQueriesCard } from './slow-queries-card'
import { Spinner } from '@/components/ui/spinner'

// Lazy load heavy components with charts to reduce initial bundle size
const ChartAreaInteractive = React.lazy(() => import('@/app/dashboard/chart-area-interactive').then(module => ({ default: module.ChartAreaInteractive })))
const DataTable = React.lazy(() => import('@/app/dashboard/data-table').then(module => ({ default: module.DataTable })))
const OwnerLoadStatusCard = React.lazy(() => import('./owner-load-status-card').then(module => ({ default: module.OwnerLoadStatusCard })))

interface DashboardPageProps {
  type: 'dashboard' | 'owner'
}

export function DashboardPage({ type }: DashboardPageProps) {
  const { user, isAuthenticated } = useAuthContext()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()

  const canViewAnalytics = hasPermission('analytics.view')
  
  useEffect(() => {
  }, [type, isAuthenticated, user?.id, canViewAnalytics])

  useEffect(() => {
    if (!isAuthenticated || !user || !user.id) {

      navigate('/login', { replace: true })
      return
    }
  }, [isAuthenticated, user, navigate])

  const dashboardStats = useDashboardStats()
  const ownerDashboard = useOwnerDashboard()

  const getCurrentData = useMemo(() => {
    switch (type) {
      case 'dashboard':
        return {
          data: dashboardStats.data,
          loading: dashboardStats.loading,
          error: dashboardStats.error,
          refetch: dashboardStats.refetch
        }
      case 'owner':
        return {
          data: ownerDashboard.stats,
          loading: ownerDashboard.loading,
          error: ownerDashboard.error,
          refetch: ownerDashboard.refetch
        }
      default:
        return { data: null, loading: false, error: null, refetch: async () => {} }
    }
  }, [type, dashboardStats, ownerDashboard])

  if (!isAuthenticated || !user || !user.id) {

    return null
  }

  if (!canViewAnalytics) {
    return (
      <div className="w-full px-2 sm:px-4 md:px-6">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">
            Dashboard
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Overview of your system performance and key metrics.
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
          <Card className="w-full max-w-md text-center mx-2 sm:mx-0">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center">
                <BarChart3 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                <h2 className="text-lg sm:text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  You don't have permission to view analytics and dashboard.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { data, loading, error, refetch } = getCurrentData

  useEffect(() => {

    if (user?.roles?.includes('owner') && type !== 'owner') {
      navigate('/owner-dashboard', { replace: true })
      return
    }

    if (user && !user.roles?.includes('owner') && type === 'owner') {
      navigate('/dashboard', { replace: true })
      return
    }
  }, [user, type, navigate])

  if (loading) {
    return <LoadingState message={`Loading ${type} dashboard...`} />
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />
  }

  const renderDashboardContent = () => {
    switch (type) {
      case 'dashboard':
        return (
          <>
            <StatCardsGrid data={data} type="dashboard" />
            <Suspense fallback={<div className="flex items-center justify-center min-h-[250px] sm:min-h-[400px]"><Spinner size="lg" message="Loading charts..." /></div>}>
              <ChartAreaInteractive />
            </Suspense>
            <Suspense fallback={<div className="flex items-center justify-center min-h-[250px] sm:min-h-[400px]"><Spinner size="lg" message="Loading data table..." /></div>}>
              <DataTable 
                data={(data as DashboardData)?.top_products || []} 
                announcements={(data as DashboardData)?.announcements || []}
                topUsers={(data as DashboardData)?.top_users || []}
              />
            </Suspense>
          </>
        )

      case 'owner':
        return (
          <>
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">System Overview</h3>
              <StatCardsGrid data={data} type="owner" />
            </div>

            <Suspense fallback={<div className="flex items-center justify-center min-h-[150px] sm:min-h-[200px]"><Spinner size="lg" message="Loading status..." /></div>}>
              <OwnerLoadStatusCard loadStatus={(data as OwnerDashboardStats)?.load_status} />
            </Suspense>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  Projects Overview
                </CardTitle>
                <CardDescription className="text-sm">
                  All projects in the system
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {(data as OwnerDashboardStats)?.project_analytics && (data as OwnerDashboardStats).project_analytics.length > 0 ? (
                    (data as OwnerDashboardStats).project_analytics.map((project: any) => (
                      <div key={project.project_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm sm:text-base truncate">{project.project_name}</h4>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-1">
                              <span>{project.users_count} users</span>
                              <span>{project.keys_count} keys</span>
                              <span>{project.products_count} products</span>
                              <span>{project.servers_count} servers</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {project.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {project.subscription_status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Building2 className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No projects found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </>
        )

      default:
        return null
    }
  }

  const getPageTitle = () => {
    switch (type) {
      case 'dashboard':
        return 'Dashboard'
      case 'owner':
        return 'Owner Dashboard'
      default:
        return 'Dashboard'
    }
  }

  const getPageDescription = () => {
    switch (type) {
      case 'dashboard':
        return 'Overview of your system performance and key metrics.'
      case 'owner':
        return `System-wide overview and management for ${user?.username}`
      default:
        return ''
    }
  }

  return (
    <div className="w-full px-2 sm:px-4 md:px-6">
      {}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">
          {getPageTitle()}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          {getPageDescription()}
        </p>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-2 sm:gap-4 md:gap-6">
          <div className="flex flex-col gap-4 sm:gap-6">
            {renderDashboardContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
