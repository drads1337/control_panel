import React from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import OwnerDashboard from './owner-dashboard'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

/**
 * Страница дашборда владельца с заголовком
 */
export function OwnerDashboardPage() {
  const { user } = useAuthContext()
  const { hasPermission } = usePermissions()
  
  const canViewAnalytics = hasPermission('analytics.view')

  if (!canViewAnalytics) {
    return (
      <div>
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Owner Dashboard
          </h2>
          <p className="text-muted-foreground">
            System-wide overview and management for {user?.username}
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md text-center">
            <CardContent className="p-6">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">
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
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Owner Dashboard
        </h2>
        <p className="text-muted-foreground">
          System-wide overview and management for {user?.username}
        </p>
      </div>

      <OwnerDashboard />
    </div>
  )
}
