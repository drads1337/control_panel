import React from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/sonner'
import { useProjectExpiration } from '@/hooks/use-project-expiration'
import { AuthGuard } from '@/app/auth/auth-guard'
import { UserLayout } from '@/app/shared/user-layout'
import { ColorInitializer } from '@/app/shared/color-initializer'
import { AppProviders } from '@/app/providers'

function AppContent() {
  const { isAuthenticated } = useAuthContext()
  const { checkProjectExpiration } = useProjectExpiration()

  // Check project expiration on mount only
  React.useEffect(() => {
    if (isAuthenticated) {
      checkProjectExpiration()
    }
  }, [isAuthenticated, checkProjectExpiration]) // checkProjectExpiration is now stable

  return (
    <AuthGuard>
      <UserLayout />
    </AuthGuard>
  )
}

function App() {
  return (
    <AppProviders>
      <ColorInitializer />
      <div className="h-screen overflow-hidden bg-background font-sans antialiased flex flex-col">
        <AppContent />
        <Toaster />
      </div>
    </AppProviders>
  )
}

export default App