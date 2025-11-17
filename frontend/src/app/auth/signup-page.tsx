import React from "react"
import { SignUpForm } from "@/app/auth/signup-form"
import { useAuthContext } from "@/contexts/auth-context"
import { Spinner } from "@/components/ui/spinner"

function SignUpPageComponent() {
  const { isAuthenticated, isInitialized, isLoading } = useAuthContext()

  // If authentication is not yet initialized or is loading, show a loading indicator
  if (!isInitialized || isLoading) {
    return <Spinner fullscreen message="Initializing..." />
  }

  // If the user is already authenticated, show a message
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
        <SignUpForm />
      </div>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export default React.memo(SignUpPageComponent)