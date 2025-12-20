import React from 'react'
import { DashboardPage } from '@/features/dashboard/owner/dashboard-page'
import { usePermissions } from '@/lib/hooks'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

function OwnerDashboardPage() {
  const { hasPermission } = usePermissions()

  const canViewAnalytics = hasPermission('analytics.view')

  const getPageTitle = () => {
    return 'Owner Dashboard'
  }

  const getPageDescription = () => {
    return 'System-wide overview and management.'
  }

  const renderDashboard = () => {
    return <DashboardPage type="owner" />
  }

  if (!canViewAnalytics) {
    return (
      <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 px-2 xs:px-3 sm:px-4 md:px-0">
        <div className="mb-3 xs:mb-4 sm:mb-5 md:mb-6">
          <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
            {getPageTitle()}
          </h1>
          <p className="text-xs xs:text-sm sm:text-sm md:text-base text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
            {getPageDescription()}
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md text-center">
            <CardContent className="p-4 xs:p-5 sm:p-6">
              <div className="text-center">
                <BarChart3 className="h-10 w-10 xs:h-12 xs:w-12 mx-auto mb-3 xs:mb-4 text-muted-foreground" />
                <h2 className="text-lg xs:text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-sm xs:text-base text-muted-foreground">
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
    <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 px-2 xs:px-3 sm:px-4 md:px-0">
      <div className="mb-3 xs:mb-4 sm:mb-5 md:mb-6">
        <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
          {getPageTitle()}
        </h1>
        <p className="text-xs xs:text-sm sm:text-sm md:text-base text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
          {getPageDescription()}
        </p>
      </div>

      {renderDashboard()}
    </div>
  )
}

export default OwnerDashboardPage
export { OwnerDashboardPage }

