import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { UserActivityStats } from '@/entities/user';
import { 
  Activity, 
  Clock, 
  MapPin, 
  Monitor, 
  TrendingUp,
  Calendar,
  Globe,
  RefreshCw,
  Loader2
} from 'lucide-react'

interface UserActivityStatsProps {
  className?: string
  stats?: {
    total_activities: number
    today_activities: number
    week_activities: number
    month_activities: number
    unique_ips: number
    unique_locations: number
    last_activity: string | null
  }
  loading?: boolean
  onRefresh?: () => void
}

export function UserActivityStats({ 
  className, 
  stats, 
  loading = false, 
  onRefresh
}: UserActivityStatsProps) {
  // If stats are not loaded, show a placeholder
  if (!stats) {
    return (
      <Card className={`@container/card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Activity Statistics
          </CardTitle>
          <CardDescription>
            An overview of your account activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatLastActivity = (dateString: string | null) => {
    if (!dateString) return 'No data'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMinutes < 1) {
      return 'Just now'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} min. ago`
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    }
  }

  return (
    <Card className={`@container/card ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activity Statistics
            </CardTitle>
            <CardDescription>
              An overview of your account activity
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/30">
            <div className="flex items-center justify-center mb-2">
              <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {stats.total_activities}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-300">Total Actions</div>
          </div>

          <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200/50 dark:border-green-800/30">
            <div className="flex items-center justify-center mb-2">
              <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {stats.today_activities}
            </div>
            <div className="text-sm text-green-600 dark:text-green-300">Today</div>
          </div>

          <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200/50 dark:border-purple-800/30">
            <div className="flex items-center justify-center mb-2">
              <Monitor className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {stats.unique_ips}
            </div>
            <div className="text-sm text-purple-600 dark:text-purple-300">Unique IPs</div>
          </div>

          <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200/50 dark:border-orange-800/30">
            <div className="flex items-center justify-center mb-2">
              <Globe className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {stats.unique_locations}
            </div>
            <div className="text-sm text-orange-600 dark:text-orange-300">Locations</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium text-foreground">Last Activity</div>
              <div className="text-sm text-muted-foreground">
                {formatLastActivity(stats.last_activity)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium text-foreground">This Week</div>
              <div className="text-sm text-muted-foreground">
                {stats.week_activities} actions
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium text-foreground">This Month</div>
              <div className="text-sm text-muted-foreground">
                {stats.month_activities} actions
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}