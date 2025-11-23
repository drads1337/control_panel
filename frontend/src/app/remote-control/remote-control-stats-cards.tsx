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
      // АДАПТАЦИЯ: 
      // grid-cols-1: На мобильных 1 колонка (карточка на всю ширину)
      // sm:grid-cols-2: На планшетах 2 колонки
      // lg:grid-cols-3: На ноутбуках 3 колонки
      // xl:grid-cols-4: На больших экранах 4 колонки
      className="
        mt-4 hidden md:grid gap-4 
        grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
        *:data-[slot=card]:from-primary/5 
        *:data-[slot=card]:to-card 
        dark:*:data-[slot=card]:bg-card 
        *:data-[slot=card]:bg-gradient-to-t 
        *:data-[slot=card]:shadow-xs
      "
    >
      {categories.map(category => {
        const categoryStats = getCategoryStats(category.id)
        return (
          <Card key={category.id} className="@container/card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              {/* truncate: обрезает длинный текст на мобильных */}
              <CardTitle className="text-sm font-medium truncate pr-2">{category.name}</CardTitle>
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: category.color }}
              />
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="text-2xl font-bold tabular-nums">{categoryStats.enabled}/{categoryStats.total}</div>
              <p className="text-xs text-muted-foreground truncate">
                {categoryStats.enabled > 0 ? 'Active Features' : 'No active features'}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}