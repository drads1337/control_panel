import React from "react"
import { SignUpForm } from "@/features/auth/components/signup-form"
import { AuthPageLayout } from "@/features/auth/components/auth-layout"

function SignUpPageComponent() {
  return (
    <AuthPageLayout>
      <SignUpForm />
    </AuthPageLayout>
  )
}

export default React.memo(SignUpPageComponent)