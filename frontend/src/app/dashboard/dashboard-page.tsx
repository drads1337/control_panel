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

// Lazy load heavy components for better code splitting
const ChartAreaInteractive = React.lazy(() => import('@/app/dashboard/chart-area-interactive').then(module => ({ default: module.ChartAreaInteractive })))
const DataTable = React.lazy(() => import('@/app/shared/data-table').then(module => ({ default: module.DataTable })))

interface DashboardPageProps {
  type: 'dashboard' | 'owner'
}

export function DashboardPage({ type }: DashboardPageProps) {
  const { user, isAuthenticated } = useAuthContext()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()

  // Check permissions
  const canViewAnalytics = hasPermission('analytics.view')

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated || !user || !user.id) {
      console.log('🔧 DASHBOARD: Redirecting to login - not authenticated')
      navigate('/login', { replace: true })
      return
    }
  }, [isAuthenticated, user, navigate])

  // Use appropriate hook based on dashboard type
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

  // Don't render anything if not authenticated
  if (!isAuthenticated || !user || !user.id) {
    console.log('🔧 DASHBOARD: Not authenticated, redirecting to login')
    return null
  }

  // Check if user has permission to view analytics
  if (!canViewAnalytics) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Dashboard
          </h2>
          <p className="text-muted-foreground">
            Overview of your system performance and key metrics.
          </p>
        </div>
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
      </div>
    )
  }

  const { data, loading, error, refetch } = getCurrentData

  useEffect(() => {
    // Handle role-based redirects
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
          </>
        )

      case 'owner':
        return (
          <>
            <div>
              <h3 className="text-2xl font-semibold mb-4">System Overview</h3>
              <StatCardsGrid data={data} type="owner" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Projects Overview
                </CardTitle>
                <CardDescription>
                  All projects in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(data as OwnerDashboardStats)?.project_analytics && (data as OwnerDashboardStats).project_analytics.length > 0 ? (
                    (data as OwnerDashboardStats).project_analytics.map((project: any) => (
                      <div key={project.project_id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{project.project_name}</h4>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{project.users_count} users</span>
                              <span>{project.keys_count} keys</span>
                              <span>{project.games_count} games</span>
                              <span>{project.servers_count} servers</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                            {project.status}
                          </Badge>
                          <Badge variant="outline">
                            {project.subscription_status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          {getPageTitle()}
        </h2>
        <p className="text-muted-foreground">
          {getPageDescription()}
        </p>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-6">
            {renderDashboardContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
