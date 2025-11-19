import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RemoteCategory, CategoryStats } from '@/lib/remote-control-api'

interface RemoteControlStatsCardsProps {
  categories: RemoteCategory[]
  stats: CategoryStats[]
}

export default function RemoteControlStatsCards({ categories, stats }: RemoteControlStatsCardsProps) {
  const getCategoryStats = (categoryId: string) => {
    const stat = stats.find(s => s.category.id === categoryId)
    if (stat) {
      return { enabled: stat.enabled, total: stat.total }
    }
    return { enabled: 0, total: 0 }
  }

  return (
    <div 
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs mt-4"
      style={{gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'}}
    >
      {categories.map(category => {
        const categoryStats = getCategoryStats(category.id)
        return (
          <Card key={category.id} className="@container/card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{category.name}</CardTitle>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: category.color }}
              />
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="text-2xl font-bold tabular-nums">{categoryStats.enabled}/{categoryStats.total}</div>
              <p className="text-xs text-muted-foreground">
                {categoryStats.enabled > 0 ? 'Active Features' : 'No active features'}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
