import { useState } from 'react'
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
import { toast } from 'sonner'
import type { UserActivityStats as UserActivityStatsType } from '@/entities/user';

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

  // Function to format the date
  const formatDate = (dateString: string) => {
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
      return `${diffInDays}d ago`
    } else {
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  // Function to get the action icon
  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return <Activity className="h-4 w-4 text-green-500 dark:text-green-400" />
      case 'logout':
        return <Activity className="h-4 w-4 text-red-500 dark:text-red-400" />
      case 'password_change':
        return <Activity className="h-4 w-4 text-blue-500 dark:text-blue-400" />
      case 'profile_update':
        return <Activity className="h-4 w-4 text-purple-500 dark:text-purple-400" />
      case 'avatar_upload':
        return <Activity className="h-4 w-4 text-orange-500 dark:text-orange-400" />
      default:
        return <Activity className="h-4 w-4 text-gray-500 dark:text-gray-400" />
    }
  }

  // Function to get the action color
  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'logout':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'password_change':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'profile_update':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      case 'avatar_upload':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300'
    }
  }

  // Function to get the readable action name
  const getActionLabel = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return 'Login'
      case 'logout':
        return 'Logout'
      case 'password_change':
        return 'Password Change'
      case 'profile_update':
        return 'Profile Update'
      case 'avatar_upload':
        return 'Avatar Upload'
      default:
        return action
    }
  }

  // Function to get the action description in Russian
  const getActionDescription = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return 'Успешный вход в систему'
      case 'logout':
        return 'Выход из системы'
      case 'password_change':
        return 'Пароль успешно изменен'
      case 'profile_update':
        return 'Обновлен профиль пользователя'
      case 'avatar_upload':
        return 'Загружен новый аватар'
      default:
        return 'Действие в системе'
    }
  }

  // Function to get browser information
  const getBrowserInfo = (userAgent: string | null) => {
    if (!userAgent) return 'Unknown'
    
    if (userAgent.includes('Chrome')) {
      const version = userAgent.match(/Chrome\/(\d+)/)?.[1]
      return `Chrome ${version || ''}`
    } else if (userAgent.includes('Firefox')) {
      const version = userAgent.match(/Firefox\/(\d+)/)?.[1]
      return `Firefox ${version || ''}`
    } else if (userAgent.includes('Safari')) {
      const version = userAgent.match(/Version\/(\d+)/)?.[1]
      return `Safari ${version || ''}`
    } else if (userAgent.includes('Edge')) {
      const version = userAgent.match(/Edge\/(\d+)/)?.[1]
      return `Edge ${version || ''}`
    } else {
      return 'Other Browser'
    }
  }

  // Error handling
  if (error) {
    return (
      <Card className={`@container/card ${className}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-center">
            <div className="space-y-3">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Loading Error</h3>
                <p className="text-gray-500">{error}</p>
                <Button onClick={refresh} className="mt-3">
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
      {/* Activity Statistics */}
      <UserActivityStats 
        stats={stats || undefined} 
        loading={loading}
        onRefresh={refresh}
      />
      
      {/* Activity List */}
      <Card className={`@container/card ${className}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Account Activity
              </CardTitle>
              <CardDescription>
                History of logins and activity in the system.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>No activity found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0">
                      {getActionIcon(activity.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getActionColor(activity.action)}>
                          {getActionLabel(activity.action)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {activity.details || getActionDescription(activity.action)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {activity.ip_address && (
                          <div className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            <span>IP: {activity.ip_address}</span>
                          </div>
                        )}
                        {(activity.country || activity.city) && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>
                              {[activity.city, activity.country].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                        {activity.user_agent && (
                          <span>{getBrowserInfo(activity.user_agent)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(activity.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.currentPage - 1) * pagination.perPage) + 1} - {Math.min(pagination.currentPage * pagination.perPage, pagination.total)} of {pagination.total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changePage(1)}
                  disabled={pagination.currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changePage(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {pagination.currentPage} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changePage(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.pages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
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