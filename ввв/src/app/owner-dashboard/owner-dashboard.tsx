import React, { Suspense } from 'react'
import { useOwnerDashboard, OwnerDashboardStats } from '@/hooks/use-owner-dashboard'
import { useDashboardStats } from '@/hooks/use-dashboard-stats'
import { LoadingState } from '@/app/dashboard/loading-state'
import { ErrorState } from '@/app/dashboard/error-state'
import { StatCardsGrid } from '@/app/dashboard/stat-cards-grid'
import { SlowQueriesCard } from '@/app/dashboard/slow-queries-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Building2, Users, Key, Database, Server, TrendingUp, Activity } from 'lucide-react'
import { format } from 'date-fns'
import { Spinner } from '@/components/ui/spinner'

const ChartAreaInteractive = React.lazy(() => import('@/app/dashboard/chart-area-interactive').then(module => ({ default: module.ChartAreaInteractive })))

export default function OwnerDashboard() {
  const { stats, loading, error, refetch } = useOwnerDashboard()
  const { data: dashboardStats } = useDashboardStats()

  if (loading) {
    return <LoadingState message="Loading system dashboard..." />
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />
  }

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 px-2 sm:px-0">
      {}
      <StatCardsGrid data={stats} type="owner" />

      {}
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading charts..." /></div>}>
        <ChartAreaInteractive />
      </Suspense>

      {}
      <Card>
        <CardHeader className="p-3 sm:p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
            Projects Overview
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            All projects in the system with detailed analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6">
          {stats?.project_analytics && stats.project_analytics.length > 0 ? (
            <div className="rounded-md border overflow-x-auto no-scrollbar -mx-2 sm:mx-0">
              <div className="min-w-[700px] sm:min-w-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Project</TableHead>
                      <TableHead className="text-xs sm:text-sm">Users</TableHead>
                      <TableHead className="text-xs sm:text-sm">Keys</TableHead>
                      <TableHead className="text-xs sm:text-sm">Products</TableHead>
                      <TableHead className="text-xs sm:text-sm">Servers</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm">Subscription</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.project_analytics.map((project: any) => (
                      <TableRow key={project.project_id}>
                        <TableCell className="text-xs sm:text-sm">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{project.project_name}</div>
                              <div className="text-[10px] xs:text-xs text-muted-foreground">
                                {project.last_activity ? format(new Date(project.last_activity), 'MMM dd, yyyy') : 'No activity'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            <span>{project.users_count}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Key className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            <span>{project.keys_count}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Database className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            <span>{project.products_count}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Server className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            <span>{project.servers_count}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-[10px] xs:text-xs">
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <Badge variant="outline" className="text-[10px] xs:text-xs">
                            {project.subscription_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm font-medium">No projects found</p>
              <p className="text-xs mt-1">Projects will appear here once created</p>
            </div>
          )}
        </CardContent>
      </Card>

      {}
      {stats?.user_analytics?.by_role && stats.user_analytics.by_role.length > 0 && (
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              User Analytics by Role
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Distribution of users across different roles
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            {/* Горизонтальный скролл на мобильных */}
            <div className="flex sm:grid sm:grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto sm:overflow-x-visible pb-2 sm:pb-0 -mx-2 sm:mx-0 px-2 sm:px-0 no-scrollbar">
              {stats.user_analytics.by_role.map((role: any, index: number) => (
                <div key={index} className="rounded-lg border p-3 sm:p-4 flex flex-col gap-2 min-w-[200px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground capitalize">
                      {role.role}
                    </span>
                    <Badge variant="outline" className="text-[10px] xs:text-xs">{role.count}</Badge>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold">{role.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {}
      {stats?.system_health && (
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
              System Health
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Current system resource usage and status
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            {/* Горизонтальный скролл на мобильных */}
            <div className="flex sm:grid sm:grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto sm:overflow-x-visible pb-2 sm:pb-0 -mx-2 sm:mx-0 px-2 sm:px-0 no-scrollbar">
              <div className="rounded-lg border p-3 sm:p-4 flex flex-col gap-2 min-w-[180px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">CPU Usage</span>
                <div className="text-xl sm:text-2xl font-bold">{stats.system_health.cpu_usage}%</div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${stats.system_health.cpu_usage}%` }}
                  />
                </div>
              </div>
              <div className="rounded-lg border p-3 sm:p-4 flex flex-col gap-2 min-w-[180px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Memory Usage</span>
                <div className="text-xl sm:text-2xl font-bold">{stats.system_health.memory_usage}%</div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${stats.system_health.memory_usage}%` }}
                  />
                </div>
              </div>
              <div className="rounded-lg border p-3 sm:p-4 flex flex-col gap-2 min-w-[180px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Disk Usage</span>
                <div className="text-xl sm:text-2xl font-bold">{stats.system_health.disk_usage}%</div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${stats.system_health.disk_usage}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 sm:mt-4 flex sm:grid sm:grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto sm:overflow-x-visible pb-2 sm:pb-0 -mx-2 sm:mx-0 px-2 sm:px-0 no-scrollbar">
              <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <span className="text-xs sm:text-sm text-muted-foreground">Database</span>
                <Badge variant={stats.system_health.database_status === 'healthy' ? 'default' : 'destructive'} className="text-[10px] xs:text-xs">
                  {stats.system_health.database_status}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <span className="text-xs sm:text-sm text-muted-foreground">Redis</span>
                <Badge variant={stats.system_health.redis_status === 'healthy' ? 'default' : 'destructive'} className="text-[10px] xs:text-xs">
                  {stats.system_health.redis_status}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <span className="text-xs sm:text-sm text-muted-foreground">Network</span>
                <Badge variant={stats.system_health.network_status === 'online' ? 'default' : 'destructive'} className="text-[10px] xs:text-xs">
                  {stats.system_health.network_status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {}
      {stats?.security_metrics && (
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
              Security Metrics
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              System security and threat monitoring
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            {/* Горизонтальный скролл на мобильных */}
            <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 overflow-x-auto sm:overflow-x-visible pb-2 sm:pb-0 -mx-2 sm:mx-0 px-2 sm:px-0 no-scrollbar">
              <div className="rounded-lg border p-3 sm:p-4 flex flex-col gap-2 min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Failed Logins</span>
                <div className="text-xl sm:text-2xl font-bold">{stats.security_metrics.failed_logins}</div>
              </div>
              <div className="rounded-lg border p-3 sm:p-4 flex flex-col gap-2 min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Blocked IPs</span>
                <div className="text-xl sm:text-2xl font-bold">{stats.security_metrics.blocked_ips}</div>
              </div>
              <div className="rounded-lg border p-3 sm:p-4 flex flex-col gap-2 min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Security Alerts</span>
                <div className="text-xl sm:text-2xl font-bold">{stats.security_metrics.security_alerts}</div>
              </div>
              <div className="rounded-lg border p-3 sm:p-4 flex flex-col gap-2 min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">2FA Enabled</span>
                <div className="text-xl sm:text-2xl font-bold">{stats.security_metrics.two_factor_enabled}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {}
      <SlowQueriesCard data={dashboardStats} />
    </div>
  )
}
