import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '@/contexts/auth-context'
import { Spinner } from '@/components/ui/spinner'
import { ProjectDeletedScreen } from '@/app/projects/project-deleted-screen'
import { PaymentRequiredScreen } from '@/app/settings/payment-required-screen'
import { useProjectExpiration } from '@/hooks/use-project-expiration'
import { GuestLayout } from '@/app/shared/guest-layout'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, isInitialized } = useAuthContext()
  const { 
    expirationStatus, 
    handlePaymentClick
  } = useProjectExpiration()

  // Show loading while authentication is initializing
  if (!isInitialized || isLoading) {
    return (
      <Spinner fullscreen size="xl" message="Loading..." description="Please wait while we initialize the application" />
    )
  }

  // Show deleted project screen if project is deleted - BLOCK ALL ACCESS
  if (expirationStatus?.isDeleted) {
    return (
      <ProjectDeletedScreen 
        projectName={expirationStatus.projectName}
      />
    )
  }

  // Show payment required screen if project is expired - BLOCK ALL ACCESS TO SITE
  if (expirationStatus?.requiresPayment) {
    return (
      <PaymentRequiredScreen 
        projectName={expirationStatus.projectName}
        gracePeriodDaysLeft={expirationStatus.gracePeriodDaysLeft}
        onPaymentClick={handlePaymentClick}
      />
    )
  }

  // Show guest layout if not authenticated
  if (!isAuthenticated) {
    return <GuestLayout />
  }

  return <>{children}</>
}
