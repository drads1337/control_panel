import React from "react"
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"
import { AuthPageLayout } from "@/features/auth/components/auth-layout"

function ForgotPasswordPageComponent() {
  return (
    <AuthPageLayout>
      <ForgotPasswordForm />
    </AuthPageLayout>
  )
}

export default React.memo(ForgotPasswordPageComponent)

