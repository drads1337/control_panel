import React from "react"
import { LoginForm } from "@/features/auth/components/login-form"
import { AuthPageLayout } from "@/features/auth/components/auth-layout"

function LoginPageComponent() {
  return (
    <AuthPageLayout>
      <LoginForm />
    </AuthPageLayout>
  )
}

export default React.memo(LoginPageComponent)