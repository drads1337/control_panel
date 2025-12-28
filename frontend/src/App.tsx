import { Routes, Route } from "react-router-dom"
import { LoginPage } from "@/features/auth"
import { DashboardPage } from "@/features/dashboard"
import { ManagementPage } from "@/features/management"
import { UsersPage } from "@/features/user-administration"
import { RemoteControlPage } from "@/features/remote-control"
import { SecurityPage } from "@/features/security"
import { WebhooksPage } from "@/features/webhooks-control"
import { LogsPage } from "@/features/logs"
import { AppLayout } from "@/components/layout"

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        }
      />
      <Route
        path="/management-page"
        element={
          <AppLayout>
            <ManagementPage />
          </AppLayout>
        }
      />
      <Route
        path="/users"
        element={
          <AppLayout>
            <UsersPage />
          </AppLayout>
        }
      />
      <Route
        path="/remote-control"
        element={
          <AppLayout>
            <RemoteControlPage />
          </AppLayout>
        }
      />
      <Route
        path="/security"
        element={
          <AppLayout>
            <SecurityPage />
          </AppLayout>
        }
      />
      <Route
        path="/webhooks"
        element={
          <AppLayout>
            <WebhooksPage />
          </AppLayout>
        }
      />
      <Route
        path="/logs"
        element={
          <AppLayout>
            <LogsPage />
          </AppLayout>
        }
      />
      <Route path="*" element={<LoginPage />} />
    </Routes>
  )
}

export default App;