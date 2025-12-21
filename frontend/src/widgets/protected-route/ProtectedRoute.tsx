import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '@/app/providers/auth-provider'
import { LoadingState } from '@/shared/ui/feedback'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isInitialized, isLoading } = useAuthContext()

  if (isLoading || !isInitialized) {
    return <LoadingState message="Loading..." fullscreen={true} useCard={false} />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

