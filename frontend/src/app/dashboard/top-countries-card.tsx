import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Globe, MapPin } from 'lucide-react'
import { DashboardData } from '@/hooks/use-dashboard-stats'
import { OwnerDashboardStats } from '@/hooks/use-owner-dashboard'

interface TopCountriesCardProps {
  data?: DashboardData | OwnerDashboardStats | null
}

export function TopCountriesCard({ data }: TopCountriesCardProps) {
  // Handle both DashboardData and OwnerDashboardStats
  const topCountries = (data as any)?.top_countries || []

  if (topCountries.length === 0) {
    return (
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
            Top Countries by Requests
          </CardTitle>
          <CardDescription className="text-sm">
            Countries with the most API requests
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No country data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate total requests for percentage calculation
  const totalRequests = topCountries.reduce((sum, item) => sum + item.requests, 0)

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
          Top Countries by Requests
        </CardTitle>
        <CardDescription className="text-sm">
          Countries with the most API requests in the last 7 days
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-3">
          {topCountries.map((item, index) => {
            const percentage = totalRequests > 0 
              ? Math.round((item.requests / totalRequests) * 100) 
              : 0
            
            return (
              <div
                key={`${item.country}-${index}`}
                className="flex items-center justify-between gap-3 sm:gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex-shrink-0">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-sm sm:text-base truncate">
                      {item.country || 'Unknown'}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="text-xs sm:text-sm font-sans">
                    {item.requests.toLocaleString()}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
