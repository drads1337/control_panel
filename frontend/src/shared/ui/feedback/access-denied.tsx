import React from "react"
import { Shield, Home, ArrowLeft } from "lucide-react"
import { StatusCard, StatusCardProps } from "./status-card"
import { Button } from "@/shared/ui/components/button"
import { useNavigate } from "react-router-dom"

export interface AccessDeniedProps extends Omit<StatusCardProps, "icon" | "variant" | "title"> {
  /** Заголовок */
  title?: string
  /** Сообщение об ошибке */
  message?: string
  /** Показать кнопку "Назад" */
  showBackButton?: boolean
  /** Показать кнопку "На главную" */
  showHomeButton?: boolean
  /** Путь для редиректа при нажатии "Назад" */
  backPath?: string
  /** Показать дополнительную информацию */
  showContactInfo?: boolean
}

/**
 * Универсальный компонент для отображения страницы "Доступ запрещен"
 * Использует единый стиль для всех страниц приложения
 */
export function AccessDenied({
  title,
  message = "You don't have permission to access this resource.",
  description,
  showBackButton = true,
  showHomeButton = true,
  backPath,
  showContactInfo = true,
  size = "md",
  actions,
  className,
  ...props
}: AccessDeniedProps) {
  const navigate = useNavigate()

  const defaultActions = (
    <>
      {showBackButton && (
        <Button
          variant="outline"
          onClick={() => (backPath ? navigate(backPath) : navigate(-1))}
        >
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
    </>
  )

  const finalDescription = description ? (
    description
  ) : (
    <div>
      <p>{message}</p>
      {showContactInfo && (
        <p className="mt-2 text-xs text-muted-foreground">
          Please contact your administrator if you believe this is an error.
        </p>
      )}
    </div>
  )

  return (
    <StatusCard
      icon={Shield}
      title={title || "Access Denied"}
      description={finalDescription}
      variant="warning"
      size={size}
      actions={actions || defaultActions}
      className={className}
      {...props}
    />
  )
}
