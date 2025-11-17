import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigationQuery } from '@/hooks/use-navigation-query'
import { getFirstAvailablePageFromNavigation } from '@/entities/navigation'
import type { User } from '@/entities/user'

interface UseAuthRedirectParams {
  isInitialized: boolean
  isLoading: boolean
  isAuthenticated: boolean
  user: User | null
}

/**
 * Hook for handling authentication redirects
 * Separated from state management for better organization
 * Uses server navigation configuration for determining redirect target
 */
export function useAuthRedirect(params: UseAuthRedirectParams) {
  const { isInitialized, isLoading, isAuthenticated, user } = params
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Get navigation configuration from server
  const { navigation } = useNavigationQuery({
    enabled: isInitialized && isAuthenticated && !!user,
  })

  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  useEffect(() => {
    // Clear any existing redirect timeout
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current)
      redirectTimeoutRef.current = null
    }

    // Only redirect if fully initialized and not loading
    if (!isInitialized || isLoading) {
      return
    }

    // Don't redirect if user is on management page
    if (window.location.pathname === '/management-page') {
      return
    }

    // Debounce redirects to prevent rapid navigation
    redirectTimeoutRef.current = setTimeout(() => {
      const currentPath = window.location.pathname

      // Redirect authenticated users away from login/signup pages
      if (isAuthenticated && user && (currentPath === '/login' || currentPath === '/signup')) {
        // Use server navigation if available, otherwise fallback to profile
        const navigationItems = navigation?.navigation || []
        const targetPage = navigationItems.length > 0
          ? getFirstAvailablePageFromNavigation(navigationItems, user)
          : '/profile'
        navigateRef.current(targetPage)
        return
      }

      // Redirect unauthenticated users to login
      if (!isAuthenticated && currentPath !== '/login' && currentPath !== '/signup') {
        navigateRef.current('/login')
      }
    }, 100)

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

