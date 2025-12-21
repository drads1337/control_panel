import React, { ReactNode } from "react"
import { ErrorBoundary } from "./error-boundary"
import { ErrorState } from "@/shared/ui/feedback"

interface PageErrorBoundaryProps {
  children: ReactNode
  pageName?: string
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface WidgetErrorBoundaryProps {
  children: ReactNode
  widgetName?: string
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

/**
 * Error Boundary specifically for page-level error handling
 * Provides a more user-friendly fallback UI for page errors
 *
 * Usage:
 * ```tsx
 * <PageErrorBoundary pageName="Dashboard">
 *   <DashboardPage />
 * </PageErrorBoundary>
 * ```
 */
export function PageErrorBoundary({
  children,
  pageName = "Page",
  onError,
}: PageErrorBoundaryProps) {
  const fallback = (
    <ErrorState
      title={`Error loading ${pageName}`}
      message="An error occurred while loading this page. Please try refreshing or contact support if the problem persists."
      showRetryButton={false}
      showReloadButton={true}
      showBackButton={false}
      showHomeButton={true}
    />
  )

  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  )
}

/**
 * Error Boundary for widget-level error handling
 * Prevents a single widget error from crashing the entire page
 *
 * Usage:
 * ```tsx
 * <WidgetErrorBoundary widgetName="User Stats">
 *   <UserStatsWidget />
 * </WidgetErrorBoundary>
 * ```
 */
export function WidgetErrorBoundary({
  children,
  widgetName = "Widget",
  onError,
}: WidgetErrorBoundaryProps) {
  const fallback = (
    <ErrorState
      title={`Error loading ${widgetName}`}
      message=""
      size="sm"
      showRetryButton={false}
      showReloadButton={false}
      showBackButton={false}
      showHomeButton={false}
      className="min-h-0"
    />
  )

  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  )
}

