import React from "react"
import { AuthProvider } from "./auth-provider"
import { QueryProvider } from "./query-provider"
import { ErrorBoundary } from "@/widgets/page-error-boundary"

interface AppProvidersProps {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary showDetails={import.meta.env.DEV}>
      <QueryProvider>
        <AuthProvider>{children}</AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  )
}