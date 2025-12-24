import React from "react"
import { FileQuestion, Home, ArrowLeft, Search } from "lucide-react"
import { StatusCard, StatusCardProps } from "./status-card"
import { Button } from "@/shared/ui/components/button"
import { useNavigate } from "react-router-dom"

export interface NotFoundProps extends Omit<StatusCardProps, "icon" | "variant"> {
  /** Показать кнопку "Назад" */
  showBackButton?: boolean
  /** Показать кнопку "На главную" */
  showHomeButton?: boolean
  /** Показать кнопку поиска */
  showSearchButton?: boolean
  /** Путь для редиректа при нажатии "Назад" */
  backPath?: string
  /** Колбэк для поиска */
  onSearch?: () => void
}

/**
 * Универсальный компонент для отображения страницы "404 Not Found"
 * Использует единый стиль для всех страниц приложения
 */
export function NotFound({
  title = "Page Not Found",
  description = "The page you're looking for doesn't exist or has been moved.",
  showBackButton = true,
  showHomeButton = true,
  showSearchButton = false,
  backPath,
  onSearch,
  size = "lg",
  actions,
  className,
  ...props
}: NotFoundProps) {
  const navigate = useNavigate()

  const defaultActions = (
    <>
      {showBackButton && (
        <Button variant="outline" onClick={() => (backPath ? navigate(backPath) : navigate(-1))}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      )}
      {showHomeButton && (
        <Button onClick={() => navigate("/dashboard")}>
          <Home className="h-4 w-4 mr-2" />
          Go to Dashboard
        </Button>
      )}
      {showSearchButton && onSearch && (
        <Button variant="ghost" onClick={onSearch}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      )}
    </>
  )

  return (
    <div className="flex items-center justify-center min-h-[60vh] sm:min-h-[70vh] p-4">
      <div className="text-center space-y-6 max-w-md w-full">
        <div className="space-y-3">
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold text-primary">
            404
          </h1>
          <StatusCard
            icon={FileQuestion}
            title={title}
            description={description}
            variant="info"
            size={size}
            actions={actions || defaultActions}
            className="min-h-0"
            {...props}
          />
        </div>
      </div>
    </div>
  )
}
