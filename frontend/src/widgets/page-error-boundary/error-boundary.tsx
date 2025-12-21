import React, { Component, ReactNode } from "react"
import { handleErrorBoundaryError } from "@/shared/lib/error-handler"
import { ErrorState } from "@/shared/ui/feedback"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  showDetails?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    })

    handleErrorBoundaryError(error, errorInfo)

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleGoHome = (): void => {
    window.location.href = "/"
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const errorDetails = this.props.showDetails && this.state.error
        ? `${this.state.error.name}: ${this.state.error.message}\n\n${
            this.state.errorInfo?.componentStack || ""
          }\n\n${this.state.error.stack || ""}`
        : undefined

      return (
        <ErrorState
          title="Something went wrong"
          message="An unexpected error occurred. Our team has been notified."
          errorDetails={errorDetails}
          showErrorDetails={!!this.props.showDetails}
          onRetry={this.handleReset}
          showReloadButton={true}
          showBackButton={false}
          showHomeButton={true}
        />
      )
    }

    return this.props.children
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || "Component"})`

  return WrappedComponent
}

