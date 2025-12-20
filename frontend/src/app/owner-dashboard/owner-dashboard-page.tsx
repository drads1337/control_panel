import React from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import OwnerDashboard from './owner-dashboard'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export function OwnerDashboardPage() {
  const { user } = useAuthContext()
  const { hasPermission } = usePermissions()

  const canViewAnalytics = hasPermission('analytics.view')

  if (!canViewAnalytics) {
    return (
      <div className="px-2 sm:px-0">
        {}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">
            Owner Dashboard
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            System-wide overview and management for {user?.username}
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
          <Card className="w-full max-w-md text-center mx-2 sm:mx-0">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center">
                <BarChart3 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                <h2 className="text-lg sm:text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  You don't have permission to view analytics and dashboard.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="px-2 sm:px-0">
      {}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">
          Owner Dashboard
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          System-wide overview and management for {user?.username}
        </p>
      </div>

      <OwnerDashboard />
    </div>
  )
}
