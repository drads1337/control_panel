import React from 'react'
import type { User } from '@/entities/user'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export interface AccessDeniedProps {
  /**
   * Whether the user is authenticated
   */
  isAuthenticated?: boolean
  /**
   * Whether the user has access to the resource
   */
  hasAccess?: boolean
  /**
   * Current user object (optional, for debug info)
   */
  user?: User | null
  /**
   * Custom title for the access denied message
   * @default "Access Denied"
   */
  title?: string
  /**
   * Custom message when user is not authenticated
   * @default "You need to be logged in to access this page."
   */
  notAuthenticatedMessage?: string
  /**
   * Custom message when user doesn't have permission
   * @default "You don't have permission to access this page."
   */
  noPermissionMessage?: string
  /**
   * Additional help text shown when user doesn't have permission
   * @default "Please contact your administrator if you believe this is an error."
   */
  helpText?: string
  /**
   * Show debug information (only in development)
   * @default false
   */
  showDebugInfo?: boolean
  /**
   * Custom debug information to display
   */
  debugInfo?: Record<string, unknown>
  /**
   * Minimum height for the container
   * @default "min-h-[300px] sm:min-h-[400px]"
   */
  minHeight?: string
  /**
   * Icon component to display (optional)
   * If not provided, defaults to AlertTriangle for no permission, Shield for not authenticated
   */
  icon?: LucideIcon
  /**
   * Whether to wrap content in a Card component
   * @default false
   */
  useCard?: boolean
  /**
   * Custom container className
   */
  containerClassName?: string
  /**
   * Custom message (overrides notAuthenticatedMessage/noPermissionMessage)
   * Useful for simple cases where you just want to show a message
   */
  message?: string
}

/**
 * Unified Access Denied component for all pages
 * Handles both authentication and authorization errors
 */
export function AccessDenied({
  isAuthenticated = true,
  hasAccess = true,
  user,
  title = 'Access Denied',
  notAuthenticatedMessage = 'You need to be logged in to access this page.',
  noPermissionMessage = "You don't have permission to access this page.",
  helpText = 'Please contact your administrator if you believe this is an error.',
  showDebugInfo = false,
  debugInfo,
  minHeight = 'min-h-[300px] sm:min-h-[400px]',
  icon,
  useCard = false,
  containerClassName,
  message: customMessage,
}: AccessDeniedProps) {
  // If user is authenticated and has access, don't render anything
  if (isAuthenticated && hasAccess) {
    return null
  }

  const isNotAuthenticated = !isAuthenticated
  const isNotAuthorized = isAuthenticated && !hasAccess

  // Determine which message to show
  let message = customMessage || noPermissionMessage
  if (isNotAuthenticated && !customMessage) {
    message = notAuthenticatedMessage
  }

  // Determine which icon to use
  let IconComponent = icon
  if (!IconComponent) {
    IconComponent = isNotAuthenticated ? Shield : AlertTriangle
  }

  // Collect debug information if needed
  const shouldShowDebug = showDebugInfo && import.meta.env.DEV && user
  const debugData = shouldShowDebug
    ? {
        user: user ? { id: user.id, email: user.email, roles: user.roles, rbac_roles: user.rbac_roles } : null,
        isAuthenticated,
        hasAccess,
        permissions: user?.permissions || [],
        ...debugInfo,
      }
    : null

  const content = (
    <div className="text-center">
      {IconComponent && (
        <IconComponent
          className={`h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 ${
            isNotAuthenticated ? 'text-muted-foreground' : 'text-red-500'
          }`}
        />
      )}
      <h2 className="text-lg sm:text-xl font-semibold mb-2">{title}</h2>
      <p className="text-sm sm:text-base text-muted-foreground">{message}</p>
      
      {isNotAuthorized && helpText && (
        <p className="text-xs sm:text-sm text-muted-foreground mt-2">{helpText}</p>
      )}

      {shouldShowDebug && debugData && (
        <details className="mt-4 text-left">
          <summary className="text-xs text-muted-foreground cursor-pointer">Debug Info</summary>
          <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-60">
            {JSON.stringify(debugData, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )

  const containerClass = containerClassName || `flex items-center justify-center ${minHeight} px-4`

  if (useCard) {
    return (
      <div className={containerClass}>
        <Card className="@container/card">
          <CardContent className="p-4 sm:p-6">
            {content}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={containerClass}>
      <div className="max-w-md w-full">{content}</div>
    </div>
  )
}

