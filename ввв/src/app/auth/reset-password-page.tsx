import React from "react"
import { ResetPasswordForm } from "@/app/auth/reset-password-form"
import { useAuthContext } from "@/contexts/auth-context"
import { Spinner } from "@/components/ui/spinner"
import { useSearchParams } from "react-router-dom"

function ResetPasswordPageComponent() {
  const { isAuthenticated, isInitialized, isLoading } = useAuthContext()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")

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

  if (!token) {
    return (
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Reset Link</h1>
          <p className="text-muted-foreground">The reset token is missing or invalid.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  )
}

export default React.memo(ResetPasswordPageComponent)

