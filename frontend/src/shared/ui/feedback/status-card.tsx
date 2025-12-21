import React from "react"
import { LucideIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card"
import { Button } from "@/shared/ui/components/button"
import { cn } from "@/shared/lib/utils/index"

export interface StatusCardProps {
  /** Иконка для отображения */
  icon: LucideIcon
  /** Заголовок */
  title: string
  /** Описание */
  description?: React.ReactNode
  /** Размер карточки */
  size?: "sm" | "md" | "lg"
  /** Вариант состояния */
  variant?: "error" | "warning" | "info" | "success" | "default"
  /** Дополнительные действия (кнопки) */
  actions?: React.ReactNode
  /** Дополнительный контент */
  children?: React.ReactNode
  /** Дополнительные классы */
  className?: string
  /** Иконка без цвета */
  iconClassName?: string
}

const variantStyles = {
  error: {
    icon: "text-destructive",
    border: "border-destructive/20",
    bg: "bg-destructive/5",
  },
  warning: {
    icon: "text-yellow-500",
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/5",
  },
  info: {
    icon: "text-primary",
    border: "border-primary/20",
    bg: "bg-primary/5",
  },
  success: {
    icon: "text-green-500",
    border: "border-green-500/20",
    bg: "bg-green-500/5",
  },
  default: {
    icon: "text-muted-foreground",
    border: "border-border",
    bg: "bg-muted/30",
  },
}

const sizeStyles = {
  sm: {
    icon: "h-8 w-8",
    padding: "p-4",
    title: "text-base",
    description: "text-sm",
  },
  md: {
    icon: "h-10 w-10",
    padding: "p-6",
    title: "text-lg",
    description: "text-sm",
  },
  lg: {
    icon: "h-12 w-12",
    padding: "p-8",
    title: "text-xl",
    description: "text-base",
  },
}

/**
 * Базовый компонент для отображения состояний (ошибки, загрузки, доступ запрещен и т.д.)
 * Обеспечивает единый стиль для всех страниц состояния
 */
export function StatusCard({
  icon: Icon,
  title,
  description,
  size = "md",
  variant = "default",
  actions,
  children,
  className,
  iconClassName,
}: StatusCardProps) {
  const variantStyle = variantStyles[variant]
  const sizeStyle = sizeStyles[size]

  return (
    <div className={cn("flex items-center justify-center min-h-[400px] p-4", className)}>
      <Card
        className={cn(
          "w-full max-w-md shadow-lg",
          variantStyle.border && `border ${variantStyle.border}`
        )}
      >
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div
              className={cn(
                "rounded-full p-3",
                variantStyle.bg
              )}
            >
              <Icon
                className={cn(
                  sizeStyle.icon,
                  iconClassName || variantStyle.icon
                )}
              />
            </div>
          </div>
          <CardTitle className={cn(sizeStyle.title, "font-bold tracking-tight")}>
            {title}
          </CardTitle>
          {description && (
            <CardDescription className={cn(sizeStyle.description, "mt-2")}>
              {description}
            </CardDescription>
          )}
        </CardHeader>
        {(children || actions) && (
          <CardContent className="space-y-4">
            {children}
            {actions && (
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {actions}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
