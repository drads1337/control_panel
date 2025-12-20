import React from "react"
import { useAuthContext } from "@/app/providers/auth-provider"
import { Spinner } from "@/components/ui/spinner"

interface AuthPageLayoutProps {
  children?: React.ReactNode
  errorMessage?: string
}

export function AuthPageLayout({ children, errorMessage }: AuthPageLayoutProps) {
  const { isAuthenticated, isInitialized, isLoading } = useAuthContext()

  if (!isInitialized || isLoading) {
    return <Spinner fullscreen message="Initializing..." size="md" />
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

  if (errorMessage) {
    return (
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Reset Link</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        {children}
      </div>
    </div>
  )
}

