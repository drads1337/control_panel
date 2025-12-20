import React, { Suspense, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Globe, MapPin, List, Map as MapIcon } from 'lucide-react'
import { DashboardData } from '@/features/dashboard/hooks/use-dashboard-stats'
import { OwnerDashboardStats } from '@/features/dashboard/hooks/use-owner-dashboard'
import { Spinner } from '@/components/ui/spinner'

const CountriesMap = React.lazy(() => import('./countries-map').then(module => ({ default: module.CountriesMap })))

interface TopCountriesCardProps {
  data?: DashboardData | OwnerDashboardStats | null
}

interface CountryItem {
  country: string
  requests: number
}

export function TopCountriesCard({ data }: TopCountriesCardProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list')
  
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
  const totalRequests = topCountries.reduce((sum: number, item: CountryItem) => sum + item.requests, 0)

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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'list' | 'map')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span>List</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              <span>Map</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="mt-0">
            <div className="space-y-3">
              {topCountries.map((item: CountryItem, index: number) => {
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
          </TabsContent>
          
          <TabsContent value="map" className="mt-0">
            <Suspense fallback={
              <div className="flex items-center justify-center h-[400px]">
                <Spinner size="lg" message="Loading map..." />
              </div>
            }>
              <CountriesMap data={data} height={400} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}