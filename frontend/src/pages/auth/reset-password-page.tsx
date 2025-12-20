import React from "react"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"
import { AuthPageLayout } from "@/features/auth/components/auth-layout"
import { useSearchParams } from "react-router-dom"

function ResetPasswordPageComponent() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")

  if (!token) {
    return (
      <AuthPageLayout errorMessage="The reset token is missing or invalid." />
    )
  }

  return (
    <AuthPageLayout>
      <ResetPasswordForm token={token} />
    </AuthPageLayout>
  )
}

export default React.memo(ResetPasswordPageComponent)

