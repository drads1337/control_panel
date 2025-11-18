import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Database, Clock, TrendingUp } from 'lucide-react'
import { DashboardData } from '@/hooks/use-dashboard-stats'

interface SlowQueriesCardProps {
  data: DashboardData | null
}

export function SlowQueriesCard({ data }: SlowQueriesCardProps) {
  if (!data?.slow_queries) {
    return null
  }

  const { summary, recent_slow_queries, top_slow_patterns } = data.slow_queries

  const getRatioColor = (ratio: number) => {
    if (ratio < 1) return 'text-green-600'
    if (ratio < 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRatioBadgeVariant = (ratio: number): "default" | "secondary" | "destructive" | "outline" => {
    if (ratio < 1) return 'default'
    if (ratio < 5) return 'secondary'
    return 'destructive'
  }

  return (
    <div className="space-y-6">
      {}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Performance Monitoring
          </CardTitle>
          <CardDescription>
            Slow query statistics and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Queries</p>
              <p className="text-2xl font-bold">{summary.total_queries.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Slow Queries</p>
              <p className="text-2xl font-bold text-orange-600">{summary.slow_queries.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avg Time</p>
              <p className="text-2xl font-bold">{summary.avg_query_time_ms.toFixed(2)}ms</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Max Time</p>
              <p className="text-2xl font-bold text-red-600">{summary.max_query_time_ms.toFixed(2)}ms</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Slow Query Ratio</span>
              </div>
              <Badge variant={getRatioBadgeVariant(summary.slow_query_ratio)}>
                <span className={getRatioColor(summary.slow_query_ratio)}>
                  {summary.slow_query_ratio.toFixed(2)}%
                </span>
              </Badge>
            </div>
            <div className="mt-2">
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    summary.slow_query_ratio < 1 ? 'bg-green-500' :
                    summary.slow_query_ratio < 5 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(summary.slow_query_ratio, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Threshold: {summary.threshold_ms}ms
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {}
      {recent_slow_queries && recent_slow_queries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Slow Queries
            </CardTitle>
            <CardDescription>
              Last {recent_slow_queries.length} slow queries detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recent_slow_queries.map((query, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{query.query_type}</Badge>
                        <span className="text-sm font-medium text-red-600">
                          {query.duration_ms.toFixed(2)}ms
                        </span>
                        {query.endpoint && (
                          <span className="text-xs text-muted-foreground">
                            {query.endpoint}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-mono bg-muted p-2 rounded text-xs break-all">
                        {query.statement_preview}
                      </p>
                      {query.tables && query.tables.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Tables:</span>
                          {query.tables.map((table, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {table}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(query.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {}
      {top_slow_patterns && top_slow_patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Slow Query Patterns
            </CardTitle>
            <CardDescription>
              Most frequently occurring slow query patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {top_slow_patterns.map((pattern, index) => (
                <div
                  key={pattern.fingerprint}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="text-sm font-medium">
                        Executed {pattern.count} times
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Avg:</span>
                      <span className="text-sm font-medium text-orange-600">
                        {pattern.avg_duration_ms.toFixed(2)}ms
                      </span>
                      <span className="text-sm text-muted-foreground">Max:</span>
                      <span className="text-sm font-medium text-red-600">
                        {pattern.max_duration_ms.toFixed(2)}ms
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-mono bg-muted p-2 rounded text-xs break-all mb-2">
                    {pattern.sample_query}
                  </p>
                  {pattern.tables && pattern.tables.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Tables:</span>
                      {pattern.tables.map((table, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {table}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
