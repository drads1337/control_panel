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
    <div className="flex flex-1 flex-col gap-6">
      {}
      <StatCardsGrid data={stats} type="owner" />

      {}
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading charts..." /></div>}>
        <ChartAreaInteractive />
      </Suspense>

      {}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Projects Overview
          </CardTitle>
          <CardDescription>
            All projects in the system with detailed analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.project_analytics && stats.project_analytics.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Keys</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Servers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscription</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.project_analytics.map((project: any) => (
                    <TableRow key={project.project_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{project.project_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {project.last_activity ? format(new Date(project.last_activity), 'MMM dd, yyyy') : 'No activity'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{project.users_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <span>{project.keys_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span>{project.products_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <span>{project.servers_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {project.subscription_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Analytics by Role
            </CardTitle>
            <CardDescription>
              Distribution of users across different roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.user_analytics.by_role.map((role: any, index: number) => (
                <div key={index} className="rounded-lg border p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground capitalize">
                      {role.role}
                    </span>
                    <Badge variant="outline">{role.count}</Badge>
                  </div>
                  <div className="text-2xl font-bold">{role.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {}
      {stats?.system_health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
            <CardDescription>
              Current system resource usage and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">CPU Usage</span>
                <div className="text-2xl font-bold">{stats.system_health.cpu_usage}%</div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${stats.system_health.cpu_usage}%` }}
                  />
                </div>
              </div>
              <div className="rounded-lg border p-4 flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Memory Usage</span>
                <div className="text-2xl font-bold">{stats.system_health.memory_usage}%</div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${stats.system_health.memory_usage}%` }}
                  />
                </div>
              </div>
              <div className="rounded-lg border p-4 flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Disk Usage</span>
                <div className="text-2xl font-bold">{stats.system_health.disk_usage}%</div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${stats.system_health.disk_usage}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm text-muted-foreground">Database</span>
                <Badge variant={stats.system_health.database_status === 'healthy' ? 'default' : 'destructive'}>
                  {stats.system_health.database_status}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm text-muted-foreground">Redis</span>
                <Badge variant={stats.system_health.redis_status === 'healthy' ? 'default' : 'destructive'}>
                  {stats.system_health.redis_status}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm text-muted-foreground">Network</span>
                <Badge variant={stats.system_health.network_status === 'online' ? 'default' : 'destructive'}>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Security Metrics
            </CardTitle>
            <CardDescription>
              System security and threat monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border p-4 flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Failed Logins</span>
                <div className="text-2xl font-bold">{stats.security_metrics.failed_logins}</div>
              </div>
              <div className="rounded-lg border p-4 flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Blocked IPs</span>
                <div className="text-2xl font-bold">{stats.security_metrics.blocked_ips}</div>
              </div>
              <div className="rounded-lg border p-4 flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Security Alerts</span>
                <div className="text-2xl font-bold">{stats.security_metrics.security_alerts}</div>
              </div>
              <div className="rounded-lg border p-4 flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">2FA Enabled</span>
                <div className="text-2xl font-bold">{stats.security_metrics.two_factor_enabled}</div>
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
