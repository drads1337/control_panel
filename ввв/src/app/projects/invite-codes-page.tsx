import { useAuthContext } from '@/contexts/auth-context'
import { InviteCodeManager } from '@/app/projects/invite-code-manager'
import { AppSidebarInner } from '@/app/shared/app-sidebar'
import { AppHeader } from '@/app/shared/app-header'
import { SidebarInset, SidebarProvider } from '@/components/animate-ui/components/radix/sidebar'
import { Navigate } from 'react-router-dom'
import { isAdmin } from '@/lib/rbac-utils'

export default function InviteCodes() {
  const { user } = useAuthContext()

  if (!user || !isAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebarInner />
      <SidebarInset>
        <div className="flex flex-col h-screen overflow-hidden">
          <AppHeader title="Invite Code Management" />

          <main className="flex-1 overflow-y-auto px-6 pt-6">
            <div className="pb-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Invite Codes for Users
                </h2>
                <p className="text-gray-600">
                  Create and manage codes for inviting users (seller/developer) to projects.
                </p>
              </div>

              <InviteCodeManager />
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}