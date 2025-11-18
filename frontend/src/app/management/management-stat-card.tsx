import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LucideIcon } from 'lucide-react'
import { ConditionalRender } from '@/components/rbac/conditional-render'

interface ManagementStatCardProps {
  permission: string
  title: string
  value: string | number
  icon: LucideIcon
  badge: {
    text: string
    icon: LucideIcon
  }
  footer: {
    description: string
    icon: LucideIcon
    details: string
  }
  loading?: boolean
}

export function ManagementStatCard({
  permission,
  title,
  value,
  icon: Icon,
  badge,
  footer,
  loading = false,
}: ManagementStatCardProps) {
  return (
    <ConditionalRender permission={permission} fallback={null}>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? '...' : value}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-primary">
              <badge.icon className="h-3 w-3" />
              {loading ? '...' : badge.text}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {footer.description} <footer.icon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {loading ? 'Loading...' : footer.details}
          </div>
        </CardFooter>
      </Card>
    </ConditionalRender>
  )
}
