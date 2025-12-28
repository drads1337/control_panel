import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigationQuery } from '@/entities/navigation'
import { getFirstAvailablePageFromNavigation } from '@/entities/navigation'
import type { User } from '@/entities/user'

interface UseAuthRedirectParams {
  isInitialized: boolean
  isLoading: boolean
  isAuthenticated: boolean
  user: User | null
}

export function useAuthRedirect(params: UseAuthRedirectParams) {
  const { isInitialized, isLoading, isAuthenticated, user } = params
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { navigation } = useNavigationQuery({
    enabled: isInitialized && isAuthenticated && !!user,
  })

  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  useEffect(() => {

    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current)
      redirectTimeoutRef.current = null
    }

    if (!isInitialized || isLoading) {
      return
    }

    if (window.location.pathname === '/management-page') {
      return
    }

    redirectTimeoutRef.current = setTimeout(() => {
      const currentPath = window.location.pathname

      if (isAuthenticated && user && (currentPath === '/login' || currentPath === '/signup')) {

        const navigationItems = navigation?.navigation || []
        const targetPage = navigationItems.length > 0
          ? getFirstAvailablePageFromNavigation(navigationItems, user)
          : '/profile'
        navigateRef.current(targetPage)
        return
      }

      // Увеличиваем задержку перед редиректом на /login, чтобы дать время
      // на восстановление сессии при перезагрузке страницы
      // Проверяем только если действительно нет пользователя и мы не на страницах входа
      if (!isAuthenticated && !user && currentPath !== '/login' && currentPath !== '/signup') {
        // Делаем редирект только если действительно нет пользователя
        // use-auth-init должен успеть восстановить сессию за это время
        navigateRef.current('/login')
      }
    }, 1000) // Увеличиваем задержку до 1 секунды, чтобы дать время на восстановление сессии

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [isInitialized, isLoading, isAuthenticated, user, navigation])

  return {
    navigate: navigateRef.current
  }
}
