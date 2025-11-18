import { useAuthContext } from '@/contexts/auth-context'
import { InviteCodeManager } from '@/app/projects/invite-code-manager'
import AppSidebar from '@/app/shared/app-sidebar'
import { AppHeader } from '@/app/shared/app-header'
import { Navigate } from 'react-router-dom'
import { isAdmin } from '@/lib/rbac-utils'

export default function InviteCodes() {
  const { user } = useAuthContext()

  if (!user || !isAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex h-screen bg-background dark:bg-background">
      {}
      <AppSidebar />

      {}
      <div className="flex-1 flex flex-col overflow-hidden">
        {}
        <AppHeader title="Invite Code Management">
          {}
        </AppHeader>

        {}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Invite Codes for Users
            </h2>
            <p className="text-gray-600">
              Create and manage codes for inviting users (seller/developer) to projects.
            </p>
          </div>

          {}
          <InviteCodeManager />
        </main>
      </div>
    </div>
  )
}