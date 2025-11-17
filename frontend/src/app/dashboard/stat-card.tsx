import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LucideIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number | React.ReactNode
  icon: LucideIcon
  subtitle?: string
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
    icon?: LucideIcon
    color?: string
  }
  footer?: {
    description: string
    details: string
    icon?: LucideIcon
  }
  className?: string
  valueClassName?: string
  loading?: boolean
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  subtitle, 
  badge,
  footer,
  className = "",
  valueClassName,
  loading = false
}: StatCardProps) {
  const badgeColorClass = badge?.color === "primary" 
    ? "text-primary" 
    : badge?.color === "blue" 
    ? "text-blue-600 dark:text-blue-400"
    : badge?.color === "yellow"
    ? "text-yellow-600 dark:text-yellow-400"
    : badge?.color === "green"
    ? "text-green-600 dark:text-green-400"
    : "text-primary"

  return (
    <Card className={`@container/card ${className}`}>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardDescription>
        <CardTitle className={cn(
          "text-2xl font-semibold tabular-nums @[250px]/card:text-3xl",
          valueClassName
        )}>
          {loading ? (
            <span className="inline-flex">
              <Spinner size="sm" message="" className="py-0" />
            </span>
          ) : (
            value
          )}
        </CardTitle>
        {badge && (
          <CardAction>
            <Badge 
              variant={badge.variant || "outline"} 
              className={badgeColorClass}
            >
              {badge.icon && React.createElement(badge.icon, { className: "h-3 w-3" })}
              {badge.text}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      {footer && (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {footer.description} {footer.icon && React.createElement(footer.icon, { className: "size-4" })}
          </div>
          <div className="text-muted-foreground">
            {footer.details}
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
