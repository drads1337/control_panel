"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserActivityQuery } from '@/features/user-administration/hooks/use-user-activity-query'
import { Activity, Loader2, MapPin, Monitor, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function ProfileActivityTab() {
  const {
    activities,
    loading,
    error,
    pagination,
    changePage,
    changePerPage,
    refetch,
  } = useUserActivityQuery({
    page: 1,
    perPage: 20,
  })

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

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login': return 'text-emerald-600 bg-emerald-50 border-emerald-200'
      case 'logout': return 'text-rose-600 bg-rose-50 border-rose-200'
      case 'password_change': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'profile_update': return 'text-purple-600 bg-purple-50 border-purple-200'
      case 'avatar_upload': return 'text-orange-600 bg-orange-50 border-orange-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatAction = (action: string) => {
    return action.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  return (
    <Card className="border rounded-lg bg-background shadow-sm">
      <CardHeader className="p-4 border-b bg-muted/30">
        <div>
          <CardTitle className="text-base sm:text-lg font-semibold">Activity History</CardTitle>
          <CardDescription className="text-xs sm:text-sm">View your recent account activity</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-xs">Failed to load activity history</p>
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-xs">No activity history found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div 
                key={activity.id} 
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-all duration-200 gap-3"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex-shrink-0 mt-0.5">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="outline" 
                        className={cn("text-[10px] h-4 px-1.5 py-0 font-medium", getActionColor(activity.action))}
                      >
                        {formatAction(activity.action)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(activity.timestamp)}
                      </span>
                    </div>
                    {activity.ip_address && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{activity.ip_address}</span>
                      </div>
                    )}
                    {activity.user_agent && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                        <Monitor className="h-3 w-3" />
                        <span className="truncate">{activity.user_agent}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

