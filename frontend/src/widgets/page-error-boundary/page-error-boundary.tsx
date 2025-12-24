import { type ReactNode } from "react"
import { RefreshCw } from "lucide-react"
import { ErrorBoundary } from "./error-boundary"
import { ErrorState } from "@/shared/ui/feedback"
import { Button } from "@/shared/ui/components/button"

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

function MinimalErrorDisplay() {
  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Error loading Page
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            An error occurred while loading this page. Please try refreshing or contact support if the problem persists.
          </p>
        </div>
        <Button 
          onClick={handleReload}
          variant="default"
          className="min-w-[140px] bg-foreground text-background hover:bg-foreground/90"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Page
        </Button>
      </div>
    </div>
  )
}

export function PageErrorBoundary({
  children,
  pageName = "Page",
  onError,
}: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={<MinimalErrorDisplay />}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  )
}

export function WidgetErrorBoundary({
  children,
  widgetName = "Widget",
  onError,
}: WidgetErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <ErrorState
          title={`Error loading ${widgetName}`}
          message=""
          size="sm"
          showRetryButton={false}
          showReloadButton={false}
          showHomeButton={false}
          className="min-h-0"
        />
      }
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  )
}