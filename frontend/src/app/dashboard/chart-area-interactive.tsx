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
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{getChartTitle()}</CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:block">
              {getChartDescription()}
            </span>
            <span className="@[540px]/card:hidden">
              {chartType === "performance" ? "API metrics" : chartType === "users" ? "User metrics" : "Key metrics"}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load chart data: {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{getChartTitle()}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {getChartDescription()}
          </span>
          <span className="@[540px]/card:hidden">
            {chartType === "performance" ? "API metrics" : chartType === "users" ? "User metrics" : "Key metrics"}
          </span>
        </CardDescription>
        <CardAction>
          <div className="flex gap-2">
            <ToggleGroup
              type="single"
              value={chartType}
              onValueChange={setChartType}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-3 @[767px]/card:flex"
            >
              <ToggleGroupItem value="performance">Perf</ToggleGroupItem>
              <ToggleGroupItem value="users">Users</ToggleGroupItem>
              <ToggleGroupItem value="keys">Keys</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={setTimeRange}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
            >
              <ToggleGroupItem value="24h">24h</ToggleGroupItem>
              <ToggleGroupItem value="7d">7d</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex gap-2 @[767px]/card:hidden">
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger
                className="flex w-32 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate h-8"
                aria-label="Select chart type"
              >
                <SelectValue placeholder="Chart type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="performance" className="rounded-lg">
                  Perf
                </SelectItem>
                <SelectItem value="users" className="rounded-lg">
                  Users
                </SelectItem>
                <SelectItem value="keys" className="rounded-lg">
                  Keys
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger
                className="flex w-24 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate h-8"
                aria-label="Select time range"
              >
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="24h" className="rounded-lg">
                  24h
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  7d
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
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
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={getXAxisKey()}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                if (chartType === "performance") {
                  return value
                }
                return value
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
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
                stackId={chartType === "users" ? "a" : undefined}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}