"use client"

import React from 'react'
import { AlertTriangle, Activity, Clock, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useLoadStatus } from '@/hooks/use-load-status'
import { Spinner } from '@/components/ui/spinner'
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"
import {
  Widget,
  WidgetContent,
  WidgetHeader,
} from "@/components/ui/widget"
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"

interface LoadStatusCardProps {
  projectId?: number | null
}

interface EndpointWidgetProps {
  endpointName: string
  endpoint: {
    requests_per_second: number
    total_requests: number
    error_count: number
    error_rate_percent: number
    response_time_ms: {
      avg: number
      p50: number
      p95: number
      p99: number
    }
    status: 'normal' | 'warning' | 'critical'
  }
  timestamp?: string
}

function EndpointWidget({ endpointName, endpoint, timestamp }: EndpointWidgetProps) {
  const chartData = [
    { 
      endpoint: endpointName, 
      rps: endpoint.requests_per_second, 
      fill: "hsl(var(--primary))" 
    },
  ]

  const chartConfig = {
    rps: {
      label: "RPS",
      color: "hsl(var(--primary))",
    },
    endpoint: {
      label: endpointName,
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig

  const getStatusColor = () => {
    switch (endpoint.status) {
      case 'critical':
        return 'text-destructive'
      case 'warning':
        return 'text-yellow-500'
      default:
        return 'text-green-500'
    }
  }

  const getStatusIcon = () => {
    switch (endpoint.status) {
      case 'critical':
        return <AlertCircle className="h-3 w-3 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />
      default:
        return <CheckCircle2 className="h-3 w-3 text-green-500" />
    }
  }

  return (
    <Widget design="mumbai" size="sm" className="p-3">
      <WidgetContent className="flex-col gap-3">
        {/* Header with status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <h3 className="text-sm font-semibold capitalize">{endpointName}</h3>
          </div>
          <Badge 
            variant={endpoint.status === 'critical' ? 'destructive' : endpoint.status === 'warning' ? 'secondary' : 'default'}
            className="text-xs"
          >
            {endpoint.status}
          </Badge>
        </div>

        {/* RPS Chart */}
        <div className="flex items-center justify-center py-2">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-20 w-20"
          >
            <RadialBarChart
              data={chartData}
              startAngle={90}
              endAngle={270}
              innerRadius={25}
              outerRadius={35}
            >
              <PolarGrid
                gridType="circle"
                radialLines={false}
                stroke="none"
                className="first:fill-muted last:fill-background"
                polarRadius={[30, 28]}
              />
              <RadialBar dataKey="rps" background cornerRadius={8} />
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) - 4}
                            className="fill-foreground text-sm font-bold"
                          >
                            {endpoint.requests_per_second.toFixed(1)}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 10}
                            className="fill-muted-foreground text-[10px]"
                          >
                            RPS
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </PolarRadiusAxis>
            </RadialBarChart>
          </ChartContainer>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-muted-foreground text-[10px]">Total</span>
              <span className="font-semibold">{endpoint.total_requests.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-muted-foreground text-[10px]">Avg</span>
              <span className="font-semibold">{endpoint.response_time_ms.avg.toFixed(0)}ms</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-muted-foreground text-[10px]">P95</span>
              <span className="font-semibold">{endpoint.response_time_ms.p95.toFixed(0)}ms</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertCircle className={`h-3 w-3 ${getStatusColor()}`} />
            <div className="flex flex-col">
              <span className="text-muted-foreground text-[10px]">Errors</span>
              <span className={`font-semibold ${getStatusColor()}`}>
                {endpoint.error_rate_percent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Timestamp */}
        {timestamp && (
          <div className="text-[10px] text-muted-foreground text-center pt-1 border-t">
            Updated: {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
      </WidgetContent>
    </Widget>
  )
}

export function LoadStatusCard({ projectId }: LoadStatusCardProps) {
  const { data, loading, error } = useLoadStatus()

  // Общая обертка для состояний загрузки/ошибки для компактности
  const StatusPlaceholder = ({ title, icon: Icon, message, subMessage }: any) => (
    <Widget design="mumbai" size="sm" className="pt-1 px-2 pb-2">
      <WidgetHeader className="bg-muted mx-auto w-max items-center justify-center rounded-md px-2 py-0.5">
        <p className="text-xs font-medium">{title}</p>
      </WidgetHeader>
      <WidgetContent className="justify-center items-center py-4 min-h-[80px]">
        {Icon ? (
          <div className="text-center">
            <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{message}</p>
            {subMessage && <p className="text-[10px] mt-0.5 text-red-500">{subMessage}</p>}
          </div>
        ) : (
          <Spinner size="sm" className="h-4 w-4" />
        )}
      </WidgetContent>
    </Widget>
  )

  // Горизонтальный скролл на мобильных, сетка на больших экранах
  const containerClass = "flex sm:grid sm:grid-cols-2 gap-2 sm:gap-3 overflow-x-auto sm:overflow-x-visible pb-2 sm:pb-0 -mx-2 sm:mx-0 px-2 sm:px-0 no-scrollbar"
  const mobileItemClass = "min-w-[280px] sm:min-w-0 flex-shrink-0 sm:flex-shrink"

  if (loading) {
    return (
      <div className={containerClass}>
        <div className={mobileItemClass}>
          <StatusPlaceholder title="connect" />
        </div>
        <div className={mobileItemClass}>
          <StatusPlaceholder title="heartbeat" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={containerClass}>
        <div className={mobileItemClass}>
          <StatusPlaceholder title="connect" icon={AlertTriangle} message="Failed" subMessage={error} />
        </div>
        <div className={mobileItemClass}>
          <StatusPlaceholder title="heartbeat" icon={AlertTriangle} message="Failed" subMessage={error} />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={containerClass}>
        <div className={mobileItemClass}>
          <StatusPlaceholder title="connect" icon={AlertTriangle} message="No data" />
        </div>
        <div className={mobileItemClass}>
          <StatusPlaceholder title="heartbeat" icon={AlertTriangle} message="No data" />
        </div>
      </div>
    )
  }

  return (
    <div className={containerClass}>
      <div className={mobileItemClass}>
        <EndpointWidget
          endpointName="connect"
          endpoint={data.endpoints.connect}
          timestamp={data.timestamp}
        />
      </div>
      <div className={mobileItemClass}>
        <EndpointWidget
          endpointName="heartbeat"
          endpoint={data.endpoints.heartbeat}
          timestamp={data.timestamp}
        />
      </div>
    </div>
  )
}
