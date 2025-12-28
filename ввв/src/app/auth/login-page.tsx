import React from "react"
import { LoginForm } from "@/app/auth/login-form"
import { useAuthContext } from "@/contexts/auth-context"
import { Spinner } from "@/components/ui/spinner"

function LoginPageComponent() {
  const { isAuthenticated, isInitialized, isLoading } = useAuthContext()

  if (!isInitialized || isLoading) {
    return (
      <Spinner fullscreen message="Initializing..." size="md" />
    )
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
        <LoginForm />
      </div>
    </div>
  )
}

export default React.memo(LoginPageComponent)