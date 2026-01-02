import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'

export type IconStyle = 'gradient' | 'dashed' | 'rounded' | 'none'

export interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: LucideIcon
  iconStyle?: IconStyle
  /**
   * Whether to show the action button (useful for conditional rendering based on permissions)
   * @default true if actionLabel and onAction are provided
   */
  canAction?: boolean
  /**
   * Whether to wrap content in a Card component
   * @default false
   */
  useCard?: boolean
  /**
   * Button size
   * @default "default"
   */
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon'
  /**
   * Show Plus icon in button
   * @default false
   */
  showButtonIcon?: boolean
  /**
   * Custom className for the container
   */
  className?: string
  /**
   * Custom className for the content wrapper
   */
  contentClassName?: string
  /**
   * Title element tag (h2, h3, etc.)
   * @default "h2"
   */
  titleTag?: 'h2' | 'h3'
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
  iconStyle = 'rounded',
  canAction,
  useCard = false,
  buttonSize = 'default',
  showButtonIcon = false,
  className = '',
  contentClassName = '',
  titleTag = 'h2',
}: EmptyStateProps) {
  const shouldShowAction = canAction !== undefined ? canAction : !!(actionLabel && onAction)
  const TitleTag = titleTag

  const renderIcon = () => {
    if (!Icon) return null

    let iconContainerClass = ''
    let iconClass = ''

    switch (iconStyle) {
      case 'gradient':
        iconContainerClass = 'w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6'
        iconClass = 'h-8 w-8 sm:h-10 sm:w-10 text-primary'
        break
      case 'dashed':
        iconContainerClass = 'w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center mx-auto mb-6'
        iconClass = 'h-10 w-10 text-muted-foreground'
        break
      case 'rounded':
        iconContainerClass = 'w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4'
        iconClass = 'h-8 w-8 text-muted-foreground'
        break
      case 'none':
        return null
    }

    return (
      <div className={iconContainerClass}>
        <Icon className={iconClass} />
      </div>
    )
  }

  const content = (
    <div className={`text-center ${contentClassName}`}>
      {renderIcon()}
      <TitleTag className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">{title}</TitleTag>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-xs sm:max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      {shouldShowAction && actionLabel && onAction && (
        <Button
          onClick={onAction}
          size={buttonSize}
          className={showButtonIcon ? 'gap-2 w-full sm:w-auto' : ''}
        >
          {showButtonIcon && <Plus className="h-5 w-5" />}
          {actionLabel}
        </Button>
      )}
    </div>
  )

  if (useCard) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/25">
        <CardContent className="p-6 sm:p-12">
          {content}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`flex flex-1 flex-col ${className}`}>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
          <div className="flex flex-col items-center justify-center gap-4 px-4 lg:px-6 py-8">
            {content}
          </div>
        </div>
      </div>
    </div>
  )
}

