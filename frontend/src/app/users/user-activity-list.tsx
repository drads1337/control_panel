import { useState, useEffect } from 'react'
import { useUserActivity } from '@/hooks/use-user-activity'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserActivityStats } from './user-activity-stats'
import { 
  RefreshCw, 
  Clock, 
  MapPin, 
  Monitor, 
  Activity,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Хук для определения размера экрана (опционально, но полезно для JS-логики)
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

interface UserActivityListProps {
  className?: string
}

export function UserActivityList({ className }: UserActivityListProps) {
  const { 
    activities, 
    stats,
    loading, 
    error, 
    pagination, 
    refresh, 
    changePage, 
    changePerPage 
  } = useUserActivity()

  // Используем media query для стилизации, но можно и просто CSS классы
  const isMobile = useMediaQuery('(max-width: 640px)');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} min. ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays < 7) return `${diffInDays}d ago`
    
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActionIcon = (action: string) => {
    const className = "h-4 w-4";
    switch (action.toLowerCase()) {
      case 'login': return <Activity className={`${className} text-green-500`} />
      case 'logout': return <Activity className={`${className} text-red-500`} />
      case 'password_change': return <Activity className={`${className} text-blue-500`} />
      case 'profile_update': return <Activity className={`${className} text-purple-500`} />
      case 'avatar_upload': return <Activity className={`${className} text-orange-500`} />
      default: return <Activity className={`${className} text-gray-500`} />
    }
  }

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200'
      case 'logout': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200'
      case 'password_change': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200'
      case 'profile_update': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200'
      case 'avatar_upload': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border-gray-200'
    }
  }

  const getActionLabel = (action: string) => {
    // Приведение к читаемому виду
    return action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  const getBrowserInfo = (userAgent: string | null) => {
    if (!userAgent) return 'Unknown'
    if (userAgent.includes('Chrome')) return `Chrome ${userAgent.match(/Chrome\/(\d+)/)?.[1] || ''}`
    if (userAgent.includes('Firefox')) return `Firefox ${userAgent.match(/Firefox\/(\d+)/)?.[1] || ''}`
    if (userAgent.includes('Safari')) return `Safari ${userAgent.match(/Version\/(\d+)/)?.[1] || ''}`
    if (userAgent.includes('Edge')) return `Edge ${userAgent.match(/Edge\/(\d+)/)?.[1] || ''}`
    return 'Other Browser'
  }

  if (error) {
    return (
      <Card className={`@container/card ${className} border-red-200 dark:border-red-900/50`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-center">
            <div className="space-y-3">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-foreground">Loading Error</h3>
                <p className="text-muted-foreground">{error}</p>
                <Button onClick={refresh} className="mt-3" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <UserActivityStats 
        stats={stats || undefined} 
        loading={loading}
        onRefresh={refresh}
      />

      <Card className={`@container/card ${className}`}>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Activity className="h-5 w-5 text-primary" />
                Account Activity
              </CardTitle>
              <CardDescription className="mt-1 text-xs sm:text-sm">
                History of logins and activity in the system.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p>No activity history found</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {activities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/40 transition-all duration-200 gap-3 sm:gap-4"
                >
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 mt-1 sm:mt-0 p-2 bg-muted/50 rounded-full">
                      {getActionIcon(activity.action)}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Верхняя строка: Бейдж и Детали */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("font-medium border", getActionColor(activity.action))}>
                          {getActionLabel(activity.action)}
                        </Badge>
                        <span className="text-sm font-medium truncate block sm:inline">
                          {activity.details}
                        </span>
                      </div>

                      {/* Метаданные: IP, Локация, Браузер */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {activity.ip_address && (
                          <div className="flex items-center gap-1.5 min-w-[100px]">
                            <Monitor className="h-3.5 w-3.5" />
                            <span className="font-sans">{activity.ip_address}</span>
                          </div>
                        )}
                        {(activity.country || activity.city) && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[150px]">
                              {[activity.city, activity.country].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                        {activity.user_agent && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                            <span>{getBrowserInfo(activity.user_agent)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Время */}
                  <div className="flex items-center justify-end sm:justify-start gap-2 pl-11 sm:pl-0 pt-1 sm:pt-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap bg-muted/30 px-2 py-1 rounded-md">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatDate(activity.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-border gap-4">
              <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Showing <span className="font-medium text-foreground">{((pagination.currentPage - 1) * pagination.perPage) + 1}</span> to <span className="font-medium text-foreground">{Math.min(pagination.currentPage * pagination.perPage, pagination.total)}</span> of <span className="font-medium text-foreground">{pagination.total}</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => changePage(1)}
                  disabled={pagination.currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => changePage(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center justify-center min-w-[3rem] text-sm font-medium">
                  {pagination.currentPage} / {pagination.pages}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => changePage(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.pages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => changePage(pagination.pages)}
                  disabled={pagination.currentPage === pagination.pages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}