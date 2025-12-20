import React from "react"
import { InviteSignUpForm } from "@/features/auth/components/invite-signup-form"
import { AuthPageLayout } from "@/features/auth/components/auth-layout"

function InviteSignUpPageComponent() {
  return (
    <AuthPageLayout>
      <InviteSignUpForm />
    </AuthPageLayout>
  )
}

export default React.memo(InviteSignUpPageComponent)

