import React, { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuthContext } from "@/app/providers/auth-provider"
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasAnyRole,
  hasAllRoles,
  canAccessFeature,
} from "@/shared/lib/rbac/rbac-utils"
import type { User } from "@/entities/user"
import { LoadingState } from "./loading-state"
import { AccessDenied } from "./access-denied"

export interface RouteGuardProps {
  children: React.ReactNode
  /** Требуемое разрешение (одно) */
  permission?: string
  /** Требуемые разрешения (несколько) */
  permissions?: string[]
  /** Все разрешения должны быть выполнены (по умолчанию: false - любое) */
  requireAll?: boolean
  /** Требуемые роли */
  roles?: string[]
  /** Любая роль или все роли (по умолчанию: true - любая) */
  requireAnyRole?: boolean
  /** Требуемая фича */
  feature?: string
  /** Путь для редиректа при отсутствии доступа */
  fallbackPath?: string
  /** Показать загрузку */
  showLoading?: boolean
  /** Сообщение загрузки */
  loadingMessage?: string
  /** Показать страницу Access Denied вместо редиректа */
  showAccessDenied?: boolean
  /** Кастомное сообщение для Access Denied */
  accessDeniedMessage?: string
}

/**
 * Универсальный компонент для защиты маршрутов
 * Проверяет аутентификацию, роли, разрешения и фичи
 * Использует единый стиль для всех состояний
 */
export function RouteGuard({
  children,
  permission,
  permissions,
  requireAll = false,
  roles,
  requireAnyRole = true,
  feature,
  fallbackPath = "/dashboard",
  showLoading = true,
  loadingMessage = "Checking access...",
  showAccessDenied = false,
  accessDeniedMessage,
}: RouteGuardProps) {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const location = useLocation()
  const [permissionsLoadTimeout, setPermissionsLoadTimeout] = useState(false)

  // Ждем инициализации
  if (!isInitialized && showLoading) {
    return <LoadingState message={loadingMessage} fullscreen={true} useCard={false} />
  }

  // Редирект на логин, если не аутентифицирован
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Проверка ролей
  if (roles && roles.length > 0) {
    const hasRole = requireAnyRole
      ? hasAnyRole(user, roles)
      : hasAllRoles(user, roles)

    if (!hasRole) {
      if (showAccessDenied) {
        return (
          <AccessDenied
            title="Access Denied"
            message={accessDeniedMessage || "You don't have the required role to access this page."}
            showBackButton={true}
            showHomeButton={true}
            backPath={fallbackPath}
          />
        )
      }
      return <Navigate to={fallbackPath} replace />
    }
  }

  // Проверка фичи
  if (feature && !canAccessFeature(user, feature)) {
    if (showAccessDenied) {
      return (
        <AccessDenied
          title="Access Denied"
          message={accessDeniedMessage || "You don't have access to this feature."}
          showBackButton={true}
          showHomeButton={true}
          backPath={fallbackPath}
        />
      )
    }
    return <Navigate to={fallbackPath} replace />
  }

  // Проверка разрешений
  if (permission || permissions) {
    const permissionsArray = permissions || (permission ? [permission] : [])
    const hasPerm = requireAll
      ? hasAllPermissions(user, permissionsArray)
      : hasAnyPermission(user, permissionsArray)

    // Если разрешения пустые, но есть роли - возможно они еще загружаются
    const permissionsEmpty = !user.permissions || Object.keys(user.permissions).length === 0
    const hasRoles = user.roles && user.roles.length > 0

    // Даем время на загрузку разрешений (2 секунды)
    useEffect(() => {
      if (permissionsEmpty && hasRoles && !permissionsLoadTimeout) {
        const timer = setTimeout(() => {
          setPermissionsLoadTimeout(true)
        }, 2000)
        return () => clearTimeout(timer)
      }
    }, [permissionsEmpty, hasRoles, permissionsLoadTimeout])

    // Если разрешения еще загружаются, показываем загрузку
    if (permissionsEmpty && hasRoles && !permissionsLoadTimeout && showLoading) {
      return <LoadingState message={loadingMessage} fullscreen={true} useCard={false} />
    }

    if (!hasPerm) {
      if (showAccessDenied) {
        return (
          <AccessDenied
            title="Access Denied"
            message={
              accessDeniedMessage ||
              `You don't have the required permission${permissionsArray.length > 1 ? "s" : ""} to access this page.`
            }
            showBackButton={true}
            showHomeButton={true}
            backPath={fallbackPath}
          />
        )
      }
      return <Navigate to={fallbackPath} replace />
    }
  }

  return <>{children}</>
}

/**
 * Упрощенный guard только для админов
 */
export function AdminRouteGuard({
  children,
  fallbackPath = "/dashboard",
  showAccessDenied = false,
}: {
  children: React.ReactNode
  fallbackPath?: string
  showAccessDenied?: boolean
}) {
  return (
    <RouteGuard
      roles={["admin", "owner"]}
      fallbackPath={fallbackPath}
      showAccessDenied={showAccessDenied}
      accessDeniedMessage="Admin access required."
    >
      {children}
    </RouteGuard>
  )
}

/**
 * Упрощенный guard только для владельца
 */
export function OwnerRouteGuard({
  children,
  fallbackPath = "/dashboard",
  showAccessDenied = false,
}: {
  children: React.ReactNode
  fallbackPath?: string
  showAccessDenied?: boolean
}) {
  return (
    <RouteGuard
      roles={["owner"]}
      fallbackPath={fallbackPath}
      showAccessDenied={showAccessDenied}
      accessDeniedMessage="Owner access required."
    >
      {children}
    </RouteGuard>
  )
}
