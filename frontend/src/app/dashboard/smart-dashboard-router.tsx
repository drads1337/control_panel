import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '@/contexts/auth-context'
import { Spinner } from '@/components/ui/spinner'
import { useNavigationQuery } from '@/entities/navigation'
import { getFirstAvailablePageFromNavigation } from '@/entities/navigation'

export function SmartDashboardRouter() {
  const { user, isInitialized } = useAuthContext()
  const { navigation } = useNavigationQuery({
    enabled: isInitialized && !!user,
  })

  if (!isInitialized) {
    return <Spinner fullscreen size="lg" message="Checking your access..." />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const navigationItems = navigation?.navigation || []
  const targetPage = getFirstAvailablePageFromNavigation(navigationItems, user)
  return <Navigate to={targetPage} replace />
}
