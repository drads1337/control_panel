import React from 'react'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUpIcon } from 'lucide-react'
import type { CategoryStats } from '@/lib/remote-control-api'

interface RemoteControlStatsProps {
  stats: CategoryStats[]
  loading?: boolean
}

export function RemoteControlStats({ stats, loading = false }: RemoteControlStatsProps) {
  const totalFeatures = stats.reduce((sum, stat) => sum + stat.total, 0)
  const enabledFeatures = stats.reduce((sum, stat) => sum + stat.enabled, 0)
  const totalCategories = stats.length

  const statCards = [
    {
      description: 'Total Categories',
      value: totalCategories,
      badgeText: `${totalCategories} categories`,
      footerText: 'Remote control sections',
      footerSubtext: 'Organized feature groups',
    },
    {
      description: 'Total Features',
      value: totalFeatures,
      badgeText: `${enabledFeatures} enabled`,
      footerText: totalFeatures > 0 ? `${Math.round((enabledFeatures / totalFeatures) * 100)}% enabled` : 'No features yet',
      footerSubtext: 'Available remote features',
    },
    {
      description: 'Enabled Features',
      value: enabledFeatures,
      badgeText: 'Active',
      footerText: 'Currently enabled features',
      footerSubtext: 'Features active for clients',
    },
    {
      description: 'Disabled Features',
      value: totalFeatures - enabledFeatures,
      badgeText: 'Inactive',
      footerText: 'Currently disabled features',
      footerSubtext: 'Features not active',
    },
  ]

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {statCards.map((stat, index) => (
        <Card key={index} className="@container/card">
          <CardHeader>
            <CardDescription>{stat.description}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                stat.value.toLocaleString()
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                <TrendingUpIcon className="h-3 w-3 mr-1" />
                {stat.badgeText}
              </Badge>
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {stat.footerText}{' '}
              <TrendingUpIcon className="size-4" />
            </div>
            <div className="text-muted-foreground">
              {stat.footerSubtext}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

