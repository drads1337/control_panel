import React from "react"
import { useAuthContext } from "@/app/providers/auth-provider"
import { Navigate } from "react-router-dom"

import { useProjectExpiration } from "@/features/project-settings/hooks/use-project-expiration"
import { Spinner } from "@/components/ui/spinner"
import { ProjectDeletedScreen } from "@/features/project-settings/project-deleted-screen"
import { PaymentRequiredScreen } from "@/features/settings/payment-required-screen"
import { GuestLayout } from "@/widgets/layout"

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
        description="Please wait while we initialize the product"
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
