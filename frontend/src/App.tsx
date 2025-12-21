import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { AppLayout } from './widgets/layout'
import { ProtectedRoute } from './widgets/protected-route'
import { LoginPage } from './features/auth'
import { DashboardPage } from './features/dashboard'
import { ProfilePage } from './features/profile'
import { ManagementPage } from './features/management'
import { ProductsPage } from './features/products/components'
import { AgentsPage } from './features/agent-management'
import { UsersPage } from './features/user-administration'
import { RemoteControlPage } from './features/remote-control'
import { SecurityPage } from './features/security'
import { WebhooksPage } from './features/webhooks-control'
import { LogsPage } from './features/logs'

function App() {
  useEffect(() => {
    // Apply dark theme class to html element
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="management" element={<ManagementPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="remote" element={<RemoteControlPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="webhooks" element={<WebhooksPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProviders>
  )
}

export default App

