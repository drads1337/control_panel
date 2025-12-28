import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface SpinnerProps {
  message?: string
  description?: string
  fullscreen?: boolean
  size?: SpinnerSize
  className?: string
  iconClassName?: string
  icon?: React.ReactNode
  overlayClassName?: string
  label?: string
  children?: React.ReactNode
}

const sizeMap: Record<SpinnerSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-6 w-6',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20'
}

export function Spinner({
  message,
  description,
  fullscreen = false,
  size = 'md',
  className,
  iconClassName,
  icon,
  overlayClassName,
  label,
  children
}: SpinnerProps) {
  const baseFullscreenClasses = 'fixed inset-0 z-50 flex flex-col items-center justify-center'
  const containerClasses = fullscreen
    ? cn(baseFullscreenClasses, 'bg-background/80 backdrop-blur-sm', overlayClassName)
    : 'flex flex-col items-center justify-center py-10'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn(containerClasses, className)}
    >
      {icon ? (
        <span className={cn('text-primary', sizeMap[size], iconClassName)}>{icon}</span>
      ) : (
        <Loader2 className={cn('animate-spin text-primary', sizeMap[size], iconClassName)} />
      )}
      {message && (
        <p className="mt-3 text-lg font-medium text-foreground">
          {message}
        </p>
      )}
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {children}
      {!message && !description && !children && (
        <span className="sr-only">Loading...</span>
      )}
    </div>
  )
}

export default Spinner