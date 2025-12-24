import React from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card"
import { Spinner } from "@/shared/ui/components/spinner"
import { cn } from "@/shared/lib/utils/index"

export interface LoadingStateProps {
  /** Сообщение загрузки */
  message?: string
  /** Описание */
  description?: string
  /** Размер */
  size?: "sm" | "md" | "lg"
  /** Полноэкранный режим */
  fullscreen?: boolean
  /** Дополнительные классы */
  className?: string
  /** Использовать карточку для отображения */
  useCard?: boolean
}

/**
 * Универсальный компонент для отображения состояния загрузки
 * Использует единый стиль для всех страниц приложения
 */
export function LoadingState({
  message = "Loading...",
  description,
  size = "md",
  fullscreen = false,
  className,
  useCard = true,
}: LoadingStateProps) {
  const sizeStyles = {
    sm: {
      icon: "h-6 w-6",
      spinner: "sm" as const,
      text: "text-sm",
    },
    md: {
      icon: "h-8 w-8",
      spinner: "md" as const,
      text: "text-base",
    },
    lg: {
      icon: "h-10 w-10",
      spinner: "lg" as const,
      text: "text-lg",
    },
  }

  const currentSize = sizeStyles[size]

  const content = (
    <div className={cn("flex flex-col items-center justify-center", currentSize.text)}>
      <Spinner size={currentSize.spinner} className="mb-4" />
      {message && (
        <p className="font-medium text-foreground mb-1">{message}</p>
      )}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )

  if (fullscreen) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
          className
        )}
      >
        {useCard ? (
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
              <CardTitle className="text-center">{message}</CardTitle>
              {description && (
                <CardDescription className="text-center">{description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>{content}</CardContent>
          </Card>
        ) : (
          content
        )}
      </div>
    )
  }

  const containerClasses = cn(
    "flex items-center justify-center min-h-[400px] p-4",
    className
  )

  if (useCard) {
    return (
      <div className={containerClasses}>
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">{message}</CardTitle>
            {description && (
              <CardDescription className="text-center">{description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>{content}</CardContent>
        </Card>
      </div>
    )
  }

  return <div className={containerClasses}>{content}</div>
}
