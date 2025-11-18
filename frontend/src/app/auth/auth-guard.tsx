import React from "react"
import { useAuthContext } from "@/contexts/auth-context"
import { Navigate } from "react-router-dom"

import { useProjectExpiration } from "@/hooks/use-project-expiration"
import { Spinner } from "@/components/ui/spinner"
import { ProjectDeletedScreen } from "@/app/projects/project-deleted-screen"
import { PaymentRequiredScreen } from "@/app/settings/payment-required-screen"
import { GuestLayout } from "@/app/shared/guest-layout"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, isInitialized } = useAuthContext()
  const { expirationStatus, handlePaymentClick } = useProjectExpiration()

  if (!isInitialized || isLoading) {
    return (
      <Spinner
        fullscreen
        size="xl"
        message="Loading..."
        description="Please wait while we initialize the application"
      />
    )
  }

  if (expirationStatus?.isDeleted) {
    return <ProjectDeletedScreen projectName={expirationStatus.projectName} />
  }

  if (expirationStatus?.requiresPayment) {
    return (
      <PaymentRequiredScreen
        projectName={expirationStatus.projectName}
        gracePeriodDaysLeft={expirationStatus.gracePeriodDaysLeft}
        onPaymentClick={handlePaymentClick}
      />
    )
  }

  if (!isAuthenticated) {
    return <GuestLayout />
  }

  return <>{children}</>
}
