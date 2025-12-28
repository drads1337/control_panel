import React from "react"
import { InviteSignUpForm } from "@/app/auth/invite-signup-form"
import { useAuthContext } from "@/contexts/auth-context"
import { Spinner } from "@/components/ui/spinner"

function InviteSignUpPageComponent() {
  const { isAuthenticated, isInitialized, isLoading } = useAuthContext()

  if (!isInitialized || isLoading) {
    return <Spinner fullscreen message="Initializing..." />
  }

  if (isAuthenticated) {
    return (
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Already Logged In</h1>
          <p className="text-muted-foreground">You are already authenticated.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <InviteSignUpForm />
      </div>
    </div>
  )
}

export default React.memo(InviteSignUpPageComponent)

