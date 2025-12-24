import React from "react"
import { AlertCircle, RefreshCw, Home, ArrowLeft } from "lucide-react"
import { StatusCard, StatusCardProps } from "./status-card"
import { Button } from "@/shared/ui/components/button"
import { useNavigate } from "react-router-dom"

export interface ErrorStateProps extends Omit<StatusCardProps, "icon" | "variant"> {
  /** Сообщение об ошибке */
  message?: string
  /** Детали ошибки (для разработки) */
  errorDetails?: string
  /** Показать кнопку "Попробовать снова" */
  showRetryButton?: boolean
  /** Показать кнопку "Перезагрузить" */
  showReloadButton?: boolean
  /** Показать кнопку "Назад" */
  showBackButton?: boolean
  /** Показать кнопку "На главную" */
  showHomeButton?: boolean
  /** Колбэк для попытки повтора */
  onRetry?: () => void
  /** Путь для редиректа при нажатии "Назад" */
  backPath?: string
  /** Показать детали ошибки */
  showErrorDetails?: boolean
}

/**
 * Универсальный компонент для отображения состояния ошибки
 * Использует единый стиль для всех страниц приложения
 */
export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this content. Please try again or contact support if the problem persists.",
  description,
  errorDetails,
  showRetryButton = true,
  showReloadButton = true,
  showBackButton = false,
  showHomeButton = true,
  onRetry,
  backPath,
  showErrorDetails = false,
  size = "md",
  actions,
  className,
  ...props
}: ErrorStateProps) {
  const navigate = useNavigate()

  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }

  const handleReload = () => {
    window.location.reload()
  }

  const defaultActions = (
    <>
      {showRetryButton && (
        <Button variant="outline" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      )}
      {showReloadButton && (
        <Button onClick={handleReload}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Page
        </Button>
      )}
      {showBackButton && (
        <Button variant="ghost" onClick={() => (backPath ? navigate(backPath) : navigate(-1))}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      )}
      {showHomeButton && (
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          <Home className="h-4 w-4 mr-2" />
          Go Home
        </Button>
      )}
    </>
  )

  const finalDescription = description ? (
    description
  ) : (
    <div>
      <p>{message}</p>
      {showErrorDetails && errorDetails && (
        <details className="mt-4 text-left">
          <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            Error Details
          </summary>
          <pre className="mt-2 text-xs overflow-auto max-h-40 text-muted-foreground font-mono bg-muted/50 p-2 rounded border border-border">
            {errorDetails}
          </pre>
        </details>
      )}
    </div>
  )

  return (
    <StatusCard
      icon={AlertCircle}
      title={title}
      description={finalDescription}
      variant="error"
      size={size}
      actions={actions || defaultActions}
      className={className}
      {...props}
    >
      {showErrorDetails && errorDetails && !description && (
        <details className="text-left">
          <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            Error Details
          </summary>
          <pre className="mt-2 text-xs overflow-auto max-h-40 text-muted-foreground font-mono bg-muted/50 p-2 rounded border border-border">
            {errorDetails}
          </pre>
        </details>
      )}
    </StatusCard>
  )
}
