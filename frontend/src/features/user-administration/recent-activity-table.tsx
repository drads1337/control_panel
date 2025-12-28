import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertTriangle, Activity, MoreHorizontal, Clock, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// Хук для определения размера экрана
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

interface RecentActivity {
  id: number
  user: string
  action: string
  timestamp: string
  status: 'success' | 'warning' | 'error'
}

interface RecentActivityTableProps {
  data: RecentActivity[]
}

export function RecentActivityTable({ data }: RecentActivityTableProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />
      default: return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20">Success</Badge>
      case 'warning': return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">Warning</Badge>
      case 'error': return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20">Error</Badge>
      default: return <Badge variant="outline">Unknown</Badge>
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = now.getTime() - time.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  // Компонент для мобильной версии строки
  const MobileActivityItem = ({ activity }: { activity: RecentActivity }) => (
    <div className="flex flex-col p-4 border-b last:border-0">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon(activity.status)}
          <span className="font-medium text-sm">{activity.user}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 -mr-2"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Export</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="pl-6 space-y-2">
        <p className="text-sm text-foreground">{activity.action}</p>
        <div className="flex items-center justify-between">
          {getStatusBadge(activity.status)}
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            {formatTimeAgo(activity.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Card className={cn(isMobile && "border-0 shadow-none bg-transparent")}>
      <CardHeader className={cn("px-6", isMobile && "px-0 pt-0")}>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className={cn("p-6", isMobile && "p-0")}>
        <div className={cn("rounded-lg border bg-card", isMobile && "border-0 bg-transparent")}>
          {data.length > 0 ? (
            isMobile ? (
              // Mobile View
              <div className="flex flex-col bg-card border rounded-lg divide-y">
                {data.map((activity) => (
                  <MobileActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              // Desktop View
              <div className="overflow-hidden rounded-lg">
                <Table>
                  <TableHeader className="bg-muted sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(activity.status)}
                            {getStatusBadge(activity.status)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {activity.user}
                        </TableCell>
                        <TableCell>
                          {activity.action}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatTimeAgo(activity.timestamp)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                                size="icon"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Export</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <div className="h-24 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-card border rounded-lg">
              <Activity className="h-8 w-8 opacity-50" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}