import React from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { UserDashboard } from './user-dashboard'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

interface DashboardPageWrapperProps {
  type: 'user'
}

function DashboardPageWrapper({ type }: DashboardPageWrapperProps) {
  const { user } = useAuthContext()
  const { hasPermission } = usePermissions()
  
  const canViewAnalytics = hasPermission('analytics.view')

  const getPageTitle = () => {
    return 'Dashboard'
  }

  const getPageDescription = () => {
    return 'Overview of your system performance and key metrics.'
  }

  const renderDashboard = () => {
    return <UserDashboard />
  }

  if (!canViewAnalytics) {
    return (
      <div>
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            {getPageTitle()}
          </h2>
          <p className="text-muted-foreground">
            {getPageDescription()}
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
          {getPageTitle()}
        </h2>
        <p className="text-muted-foreground">
          {getPageDescription()}
        </p>
      </div>

      {renderDashboard()}
    </div>
  )
}

export default DashboardPageWrapper
export { DashboardPageWrapper }