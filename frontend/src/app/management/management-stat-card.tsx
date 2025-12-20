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
        <CardHeader className="p-2 xs:p-2.5 sm:p-3 md:p-4 lg:p-6">
          <CardDescription className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-[10px] xs:text-xs sm:text-sm leading-tight">
            <Icon className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            {title}
          </CardDescription>
          <CardTitle className="text-base xs:text-lg sm:text-xl md:text-2xl font-semibold tabular-nums @[250px]/card:text-xl @[300px]/card:text-2xl @[400px]/card:text-3xl leading-tight mt-1 xs:mt-1.5">
            {loading ? '...' : value}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-primary text-[10px] xs:text-xs px-1.5 xs:px-2 py-0.5 leading-tight">
              <badge.icon className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-3 sm:w-3 flex-shrink-0" />
              {loading ? '...' : badge.text}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-0.5 xs:gap-1 sm:gap-1.5 text-[10px] xs:text-xs sm:text-sm p-2 xs:p-2.5 sm:p-3 md:p-4 lg:p-6 pt-0">
          <div className="line-clamp-1 flex gap-1 xs:gap-1.5 sm:gap-2 font-medium leading-tight">
            {footer.description} <footer.icon className="size-2.5 xs:size-3 sm:size-4 flex-shrink-0" />
          </div>
          <div className="text-muted-foreground text-[10px] xs:text-xs leading-tight">
            {loading ? 'Loading...' : footer.details}
          </div>
        </CardFooter>
      </Card>
    </ConditionalRender>
  )
}
