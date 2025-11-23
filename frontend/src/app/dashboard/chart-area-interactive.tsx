"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { useApiMetrics } from "@/hooks/use-api-metrics"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { sanitizeString } from "@/lib/sanitization"
import type { User } from '@/entities/user';

const chartConfig = {
  requests: {
    label: "API Requests",
    color: "var(--chart-1)",
  },
  errors: {
    label: "Errors",
    color: "var(--chart-2)",
  },
  latency: {
    label: "Latency (ms)",
    color: "var(--chart-3)",
  },
  active: {
    label: "Active Users",
    color: "var(--chart-1)",
  },
  new: {
    label: "New Users",
    color: "var(--chart-2)",
  },
  returning: {
    label: "Returning Users",
    color: "var(--chart-3)",
  },
  key_generation: {
    label: "Key Generation",
    color: "var(--chart-4)",
  },
  key_activation: {
    label: "Key Activation",
    color: "var(--chart-5)",
  },
  key_expired: {
    label: "Key Expired",
    color: "var(--chart-6)",
  },
  connect_requests: {
    label: "Connect Requests",
    color: "var(--chart-7)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const [timeRange, setTimeRange] = React.useState("7d")
  const [chartType, setChartType] = React.useState("performance")
  const { data, isLoading, error } = useApiMetrics()

  const performanceData = React.useMemo(() => {
    if (!data?.performance_data) return []

    return data.performance_data.map(item => ({
      time: item.time,
      requests: item.requests,
      errors: item.errors,
      latency: item.latency
    }))
  }, [data?.performance_data])

  const userActivityData = React.useMemo(() => {
    if (!data?.user_activity_data) return []

    return data.user_activity_data.map(item => ({
      date: item.date,
      active: item.active,
      new: item.new,
      returning: item.returning,
      key_generation: item.key_generation,
      key_activation: item.key_activation,
      key_expired: item.key_expired,
      connect_requests: item.connect_requests
    }))
  }, [data?.user_activity_data])

  const filteredData = React.useMemo(() => {
    const currentData = chartType === "performance" ? performanceData : userActivityData
    const dateKey = chartType === "performance" ? "time" : "date"

    if (!currentData.length) return []

    let itemsToShow = currentData.length
    if (timeRange === "7d") {
      itemsToShow = Math.min(7, currentData.length)
    } else if (timeRange === "24h") {
      itemsToShow = Math.min(24, currentData.length)
    }

    return currentData.slice(-itemsToShow)
  }, [performanceData, userActivityData, timeRange, chartType])

  const getChartTitle = () => {
    if (chartType === "performance") {
      return "API Performance"
    } else if (chartType === "users") {
      return "User Activity"
    } else if (chartType === "keys") {
      return "Key Management"
    }
    return "Chart"
  }

  const getChartDescription = () => {
    if (chartType === "performance") {
      return "API request metrics and system performance"
    } else if (chartType === "users") {
      return "User engagement and activity patterns"
    } else if (chartType === "keys") {
      return "Key generation, activation, expiration and connection requests"
    }
    return "Chart data"
  }

  const getDataKeys = () => {
    if (chartType === "performance") {
      return ["requests", "errors", "latency"]
    } else if (chartType === "users") {
      return ["active", "new", "returning"]
    } else if (chartType === "keys") {
      return ["key_generation", "key_activation", "key_expired", "connect_requests"]
    }
    return []
  }

  const getXAxisKey = () => {
    return chartType === "performance" ? "time" : "date"
  }

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
          <Skeleton className="h-5 w-28 sm:h-6 sm:w-32" />
          <Skeleton className="h-3 w-40 sm:h-4 sm:w-48 mt-1" />
        </CardHeader>
        <CardContent className="px-2 pt-2 pb-3 sm:px-4 sm:pt-4 sm:pb-6 md:px-6 md:pt-6">
          <Skeleton className="h-[180px] xs:h-[200px] sm:h-[250px] md:h-[300px] lg:h-[350px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="@container/card">
        <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
          <CardTitle className="text-base sm:text-lg md:text-xl">{getChartTitle()}</CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1">
            <span className="hidden @[540px]/card:block">
              {getChartDescription()}
            </span>
            <span className="@[540px]/card:hidden">
              {chartType === "performance" ? "API metrics" : chartType === "users" ? "User metrics" : "Key metrics"}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 pt-2 pb-3 sm:px-4 sm:pt-4 sm:pb-6 md:px-6 md:pt-6">
          <Alert variant="destructive" className="text-xs sm:text-sm">
            <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <AlertDescription className="text-xs sm:text-sm">
              Failed to load chart data: {sanitizeString(String(error))}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card w-full">
      <CardHeader className="px-3 py-3 sm:px-6 sm:py-4 space-y-2 sm:space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base sm:text-lg md:text-lg leading-tight">
              {getChartTitle()}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1 sm:mt-1.5">
              <span className="hidden @[540px]/card:block">
                {getChartDescription()}
              </span>
              <span className="@[540px]/card:hidden">
                {chartType === "performance" ? "API metrics" : chartType === "users" ? "User metrics" : "Key metrics"}
              </span>
            </CardDescription>
          </div>
          <CardAction className="flex-shrink-0 mt-1 sm:mt-0">
            <div className="flex gap-1.5 sm:gap-2">
              <ToggleGroup
                type="single"
                value={chartType}
                onValueChange={setChartType}
                variant="outline"
                className="hidden *:data-[slot=toggle-group-item]:!px-2 *:data-[slot=toggle-group-item]:!text-xs sm:*:data-[slot=toggle-group-item]:!px-3 sm:*:data-[slot=toggle-group-item]:!text-sm @[767px]/card:flex"
              >
                <ToggleGroupItem value="performance" className="text-xs sm:text-sm">Perf</ToggleGroupItem>
                <ToggleGroupItem value="users" className="text-xs sm:text-sm">Users</ToggleGroupItem>
                <ToggleGroupItem value="keys" className="text-xs sm:text-sm">Keys</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup
                type="single"
                value={timeRange}
                onValueChange={setTimeRange}
                variant="outline"
                className="hidden *:data-[slot=toggle-group-item]:!px-2.5 *:data-[slot=toggle-group-item]:!text-xs sm:*:data-[slot=toggle-group-item]:!px-4 sm:*:data-[slot=toggle-group-item]:!text-sm @[767px]/card:flex"
              >
                <ToggleGroupItem value="24h" className="text-xs sm:text-sm">24h</ToggleGroupItem>
                <ToggleGroupItem value="7d" className="text-xs sm:text-sm">7d</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex gap-1.5 sm:gap-2 @[767px]/card:hidden">
              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger
                  className="flex w-28 xs:w-32 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate h-8 text-xs sm:text-sm"
                  aria-label="Select chart type"
                >
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="performance" className="rounded-lg text-xs sm:text-sm">
                    Perf
                  </SelectItem>
                  <SelectItem value="users" className="rounded-lg text-xs sm:text-sm">
                    Users
                  </SelectItem>
                  <SelectItem value="keys" className="rounded-lg text-xs sm:text-sm">
                    Keys
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger
                  className="flex w-20 xs:w-24 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate h-8 text-xs sm:text-sm"
                  aria-label="Select time range"
                >
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="24h" className="rounded-lg text-xs sm:text-sm">
                    24h
                  </SelectItem>
                  <SelectItem value="7d" className="rounded-lg text-xs sm:text-sm">
                    7d
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-2 pb-3 sm:px-4 sm:pt-4 sm:pb-6 md:px-6 md:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[180px] xs:h-[200px] sm:h-[250px] md:h-[300px] lg:h-[350px] xl:h-[400px] w-full"
        >
          <AreaChart 
            data={filteredData}
            margin={{ top: 8, right: 4, bottom: 20, left: 4 }}
            className="w-full"
          >
            <defs>
              {getDataKeys().map((key, index) => (
                <linearGradient key={key} id={`fill${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={`var(--color-${key})`}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={`var(--color-${key})`}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey={getXAxisKey()}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              minTickGap={8}
              tick={{ fontSize: 10 }}
              className="text-[10px] xs:text-xs sm:text-sm"
              interval="preserveStartEnd"
              tickFormatter={(value) => {
                if (chartType === "performance") {
                  // Форматируем время - показываем только часы:минуты для компактности
                  if (typeof value === 'string' && value.includes(':')) {
                    const parts = value.split(' ')
                    return parts.length > 1 ? parts[1] : value
                  }
                  return value
                }
                // Для дат - показываем короткий формат
                if (typeof value === 'string') {
                  try {
                    const date = new Date(value)
                    if (!isNaN(date.getTime())) {
                      // Короткий формат: М/Д
                      return `${date.getMonth() + 1}/${date.getDate()}`
                    }
                  } catch {
                    // Если не удалось распарсить, возвращаем как есть
                  }
                }
                return value
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className="text-xs sm:text-sm"
                  labelFormatter={(value) => {
                    if (chartType === "performance") {
                      return value
                    }
                    return value
                  }}
                  indicator="dot"
                />
              }
            />
            {getDataKeys().map((key) => (
              <Area
                key={key}
                dataKey={key}
                type="natural"
                fill={`url(#fill${key})`}
                stroke={`var(--color-${key})`}
                strokeWidth={1.5}
                stackId={chartType === "users" ? "a" : undefined}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}