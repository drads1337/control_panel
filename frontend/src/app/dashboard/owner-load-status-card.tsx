import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, AlertTriangle, CheckCircle2, XCircle, Zap, Clock, TrendingUp } from 'lucide-react'
import type { OwnerDashboardStats } from '@/hooks/use-owner-dashboard'

interface OwnerLoadStatusCardProps {
  loadStatus?: OwnerDashboardStats['load_status']
}

export function OwnerLoadStatusCard({ loadStatus }: OwnerLoadStatusCardProps) {
  if (!loadStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Load Status
          </CardTitle>
          <CardDescription>
            Load status data is not available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No load status data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
    }
  }

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'critical':
        return 'destructive'
      case 'warning':
        return 'secondary'
      default:
        return 'default'
    }
  }

  const renderEndpointStatus = (endpoint: any, endpointName: string) => {
    return (
      <div key={endpointName} className="space-y-3 p-4 rounded-lg border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(endpoint.status)}
            <h4 className="font-semibold capitalize">{endpointName}</h4>
            <Badge variant={getStatusBadgeVariant(endpoint.status)}>
              {endpoint.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span>Requests/sec</span>
            </div>
            <div className="text-lg font-semibold">
              {endpoint.requests_per_second.toFixed(1)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Total Requests</span>
            </div>
            <div className="text-lg font-semibold">
              {endpoint.total_requests.toLocaleString()}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Avg Response</span>
            </div>
            <div className="text-lg font-semibold">
              {endpoint.response_time_ms.avg.toFixed(0)}ms
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              <span>Error Rate</span>
            </div>
            <div className="text-lg font-semibold">
              {endpoint.error_rate_percent.toFixed(2)}%
            </div>
          </div>
        </div>

        {endpoint.response_time_ms && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">Response Time Percentiles</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">P50:</span>{' '}
                <span className="font-medium">{endpoint.response_time_ms.p50.toFixed(0)}ms</span>
              </div>
              <div>
                <span className="text-muted-foreground">P95:</span>{' '}
                <span className="font-medium">{endpoint.response_time_ms.p95.toFixed(0)}ms</span>
              </div>
              <div>
                <span className="text-muted-foreground">P99:</span>{' '}
                <span className="font-medium">{endpoint.response_time_ms.p99.toFixed(0)}ms</span>
              </div>
            </div>
          </div>
        )}

        {endpoint.recommendations && endpoint.recommendations.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-1">Recommendations:</div>
            <ul className="text-xs space-y-1">
              {endpoint.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="text-yellow-600 dark:text-yellow-400">
                  • {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Load Status
        </CardTitle>
        <CardDescription>
          Real-time monitoring of connect and heartbeat endpoints across all projects
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall Status */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2">
              {getStatusIcon(loadStatus.overall_status)}
              <span className="font-medium">Overall Status</span>
            </div>
            <Badge variant={getStatusBadgeVariant(loadStatus.overall_status)}>
              {loadStatus.overall_status}
            </Badge>
          </div>

          {/* Endpoints */}
          <div className="space-y-3">
            {renderEndpointStatus(loadStatus.endpoints.connect, 'connect')}
            {renderEndpointStatus(loadStatus.endpoints.heartbeat, 'heartbeat')}
          </div>

          {/* Last Updated */}
          {loadStatus.timestamp && (
            <div className="text-xs text-muted-foreground text-center pt-2">
              Last updated: {new Date(loadStatus.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

