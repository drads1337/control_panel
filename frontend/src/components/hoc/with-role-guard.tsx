import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '@/contexts/auth-context'
import { Spinner } from '@/components/ui/spinner'
import { hasAnyRole, hasAllRoles, canAccessFeature, hasPermission } from '@/lib/rbac-utils'

interface WithRoleGuardOptions {
  requiredRoles?: string[]
  requireAllRoles?: boolean
  permissions?: string[]
  requireAllPermissions?: boolean
  feature?: string
  redirectTo?: string
  fallbackPath?: string
  showLoading?: boolean
  loadingMessage?: string
}

/**
 * Higher-Order Component для защиты роутов на основе ролей пользователя
 * Решает проблему "мигания" контента путем проверки ролей до рендеринга
 * Поддерживает проверку ролей, permissions и features
 */
export function withRoleGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithRoleGuardOptions = {}
) {
  const {
    requiredRoles = [],
    requireAllRoles = false,
    permissions = [],
    requireAllPermissions = false,
    feature,
    redirectTo,
    fallbackPath = '/dashboard',
    showLoading = true,
    loadingMessage = 'Checking access...'
  } = options

  const RoleGuardedComponent = (props: P) => {
    const { user, isAuthenticated, isInitialized } = useAuthContext()

    // Показываем загрузку пока не инициализирована аутентификация
    if (!isInitialized && showLoading) {
      return <Spinner fullscreen size="lg" message={loadingMessage} />
    }

    // Редирект на логин если не аутентифицирован
    if (!isAuthenticated || !user) {
      return <Navigate to="/login" replace />
    }

    // Проверяем feature access
    if (feature && !canAccessFeature(user, feature)) {
      const redirectPath = redirectTo || fallbackPath
      return <Navigate to={redirectPath} replace />
    }

    // Проверяем роли если они требуются
    if (requiredRoles.length > 0) {
      const hasRequiredRole = requireAllRoles 
        ? hasAllRoles(user, requiredRoles)
        : hasAnyRole(user, requiredRoles)

      if (!hasRequiredRole) {
        const redirectPath = redirectTo || fallbackPath
        return <Navigate to={redirectPath} replace />
      }
    }

    // Проверяем permissions если они требуются
    if (permissions.length > 0) {
      const hasRequiredPermissions = requireAllPermissions
        ? permissions.every(permission => hasPermission(user, permission))
        : permissions.some(permission => hasPermission(user, permission))

      if (!hasRequiredPermissions) {
        const redirectPath = redirectTo || fallbackPath
        return <Navigate to={redirectPath} replace />
      }
    }

    // Если все проверки пройдены, рендерим компонент
    return <WrappedComponent {...props} />
  }

  // Устанавливаем displayName для отладки
  RoleGuardedComponent.displayName = `withRoleGuard(${WrappedComponent.displayName || WrappedComponent.name})`

  return RoleGuardedComponent
}

/**
 * Специализированные HOC для частых случаев
 */
export const withOwnerGuard = <P extends object>(Component: React.ComponentType<P>) =>
  withRoleGuard(Component, { 
    requiredRoles: ['owner'], 
    fallbackPath: '/dashboard' 
  })

export const withAuthGuard = <P extends object>(Component: React.ComponentType<P>) =>
  withRoleGuard(Component, { 
    requiredRoles: [], 
    fallbackPath: '/login' 
  })
