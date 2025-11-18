import React from 'react'

type LoadingSize = 'sm' | 'md' | 'lg' | 'xl'

interface LoadingProps {
  message?: string
  description?: string
  fullscreen?: boolean
  size?: LoadingSize
  className?: string
}

const sizeToClasses: Record<LoadingSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16'
}

export function Loading({
  message = 'Loading...;',
  description,
  fullscreen = false,
  size = 'md',
  className = ''
}: LoadingProps) {
  const containerClasses = fullscreen
    ? 'flex items-center justify-center min-h-screen'
    : 'flex items-center justify-center py-8'

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="text-center">
        <div className={`animate-spin rounded-full ${sizeToClasses[size]} border-b-2 border-primary mx-auto mb-3`}></div>
        {message && <p className="text-sm text-foreground/90">{message}</p>}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
    </div>
  )
}

export default Loading
