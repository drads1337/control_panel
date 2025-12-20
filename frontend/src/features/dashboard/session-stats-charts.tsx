import React from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import type { SessionStats } from '@/entities/session/model/types'

const chartConfig = {
  count: {
    label: "Sessions",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

interface SessionStatsChartsProps {
  stats: SessionStats | null
}

export function SessionStatsCharts({ stats }: SessionStatsChartsProps) {

  const hourData = React.useMemo(() => {
    if (!stats?.hour_stats || stats.hour_stats.length === 0) return []

    return stats.hour_stats.map(item => ({
      hour: `${item.hour}:00`,
      count: item.count,
    }))
  }, [stats?.hour_stats])

  const dayData = React.useMemo(() => {
    if (!stats?.day_stats || stats.day_stats.length === 0) return []

    return stats.day_stats.map(item => ({
      day: new Date(item.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: item.count,
    }))
  }, [stats?.day_stats])

  if (!stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {}
      {hourData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sessions by Hour</CardTitle>
            <CardDescription>
              Distribution of sessions throughout the day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {}
      {dayData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sessions by Day</CardTitle>
            <CardDescription>
              Daily session activity over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {}
      {hourData.length === 0 && dayData.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">No chart data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
