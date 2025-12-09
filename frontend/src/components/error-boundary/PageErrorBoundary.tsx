import React, { Component, ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

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
  pageName = 'Page',
  onError 
}: PageErrorBoundaryProps) {
  const fallback = (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Error loading {pageName}</CardTitle>
          </div>
          <CardDescription>
            An error occurred while loading this page. Please try refreshing or contact support if the problem persists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Reload Page
          </button>
        </CardContent>
      </Card>
    </div>
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
  widgetName = 'Widget',
  onError 
}: WidgetErrorBoundaryProps) {
  const fallback = (
    <Card className="border-destructive/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Error loading {widgetName}</span>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  )
}
