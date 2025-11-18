import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, Plus, Settings } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { ConditionalRender } from '@/components/rbac/conditional-render'

export default function NotificationsManager() {
  const { hasPermission } = usePermissions()

  const canViewNotifications = hasPermission('notifications.view')
  const canCreateNotifications = hasPermission('notifications.create')
  const canEditNotifications = hasPermission('notifications.edit')
  const canDeleteNotifications = hasPermission('notifications.delete')

  if (!canViewNotifications) {
    return (
      <Card className="text-center p-8">
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-muted-foreground">You don't have permission to view notifications.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Notifications Management</h3>
          <p className="text-muted-foreground">
            Create and manage system notifications and alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConditionalRender permission="notifications.view" fallback={null}>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              disabled={!canViewNotifications}
            >
              <Bell className="h-4 w-4" />
              View All
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="notifications.create" fallback={null}>
            <Button
              className="flex items-center gap-2"
              disabled={!canCreateNotifications}
            >
              <Plus className="h-4 w-4" />
              Create Notification
            </Button>
          </ConditionalRender>
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              Currently active notifications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
              Scheduled for future delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Badge variant="outline" className="text-green-600">
              <Bell className="h-3 w-3" />
              1,234
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              Notifications sent this month
            </p>
          </CardContent>
        </Card>
      </div>

      {}
      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
          <CardDescription>
            Latest notifications created in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">System Maintenance</p>
                  <p className="text-sm text-muted-foreground">
                    Scheduled maintenance notification
                  </p>
                </div>
              </div>
              <Badge variant="outline">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Security Alert</p>
                  <p className="text-sm text-muted-foreground">
                    Unusual login activity detected
                  </p>
                </div>
              </div>
              <Badge variant="outline">Scheduled</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Feature Update</p>
                  <p className="text-sm text-muted-foreground">
                    New features available in the system
                  </p>
                </div>
              </div>
              <Badge variant="outline">Completed</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
