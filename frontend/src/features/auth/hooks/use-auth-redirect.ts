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

// Список защищенных страниц, которые требуют аутентификации
const PROTECTED_PAGES = [
  '/dashboard',
  '/management-page',
  '/users',
  '/remote-control',
  '/security',
  '/webhooks',
  '/logs',
  '/profile',
]

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
    console.log('[AUTH-REDIRECT] Effect triggered', {
      isInitialized,
      isLoading,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
      currentPath: window.location.pathname
    })

    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current)
      redirectTimeoutRef.current = null
    }

    const currentPath = window.location.pathname
    const isProtectedPage = PROTECTED_PAGES.includes(currentPath)

    // Если мы на защищенной странице и еще идет инициализация, не редиректим
    // Это позволяет избежать редиректа на login во время восстановления сессии
    if (isProtectedPage && (!isInitialized || isLoading)) {
      console.log('[AUTH-REDIRECT] Skipping redirect - protected page, initialization in progress', {
        isInitialized,
        isLoading,
        currentPath
      })
      return
    }

    if (!isInitialized || isLoading) {
      console.log('[AUTH-REDIRECT] Skipping redirect - not ready', {
        isInitialized,
        isLoading
      })
      return
    }

    // For authenticated users, redirect immediately without delay
    if (isAuthenticated && user && (currentPath === '/login' || currentPath === '/signup' || currentPath === '/')) {
      console.log('[AUTH-REDIRECT] Immediate redirect for authenticated user', {
        currentPath,
        userId: user.id,
        hasNavigation: !!navigation
      })
      
      // Don't wait for navigation to load - use fallback immediately
      // Navigation can load in background, but we should redirect user right away
      // This prevents rate limiting issues from blocking the redirect
      const navigationItems = navigation?.navigation || []
      const targetPage = navigationItems.length > 0
        ? getFirstAvailablePageFromNavigation(navigationItems, user)
        : '/dashboard'
      
      console.log('[AUTH-REDIRECT] Redirecting authenticated user', {
        from: currentPath,
        to: targetPage,
        navigationItemsCount: navigationItems.length
      })
      
      navigateRef.current(targetPage)
      return
    }

    redirectTimeoutRef.current = setTimeout(() => {
      const currentPath = window.location.pathname
      const isProtectedPage = PROTECTED_PAGES.includes(currentPath)
      
      console.log('[AUTH-REDIRECT] Checking redirect', {
        currentPath,
        isAuthenticated,
        hasUser: !!user,
        userId: user?.id,
        hasNavigation: !!navigation,
        isProtectedPage
      })

      // Redirect authenticated users away from login/signup pages or root path (fallback check)
      if (isAuthenticated && user && (currentPath === '/login' || currentPath === '/signup' || currentPath === '/')) {
        const navigationItems = navigation?.navigation || []
        const targetPage = navigationItems.length > 0
          ? getFirstAvailablePageFromNavigation(navigationItems, user)
          : '/dashboard'
        
        console.log('[AUTH-REDIRECT] Redirecting authenticated user (delayed)', {
          from: currentPath,
          to: targetPage,
          navigationItemsCount: navigationItems.length
        })
        
        navigateRef.current(targetPage)
        return
      }

      // Редиректим на login только если:
      // 1. Пользователь не аутентифицирован
      // 2. Мы на защищенной странице
      // 3. Инициализация завершена (чтобы дать время на восстановление сессии)
      if (!isAuthenticated && !user && isProtectedPage) {
        console.log('[AUTH-REDIRECT] Redirecting unauthenticated user to login', { from: currentPath })
        navigateRef.current('/login')
      }
    }, 500) // Reduced delay to 500ms - navigation query should not block redirect

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
