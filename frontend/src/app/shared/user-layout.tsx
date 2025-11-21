import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthContext } from '@/contexts/auth-context'
import { usePageConfig } from '@/hooks/use-page-config'
import { AppLayout } from '@/app/shared/app-layout'
import { AnimatedPage } from '@/app/shared/page-transition'
import { Spinner } from '@/components/ui/spinner'
import { 
  RouteGuard, 
  AdminRouteGuard, 
  OwnerRouteGuard, 
  SellerRouteGuard, 
  DeveloperRouteGuard,
  UsersManagementGuard,
  RBACManagementGuard,
  ProjectSettingsGuard,
  KeyManagementGuard,
  ProductManagementGuard,
  AnalyticsGuard,
  FileManagementGuard,
  RemoteControlGuard,
  WebhooksGuard,
  ProjectsGuard,
  ServersGuard,
  ManagementPageGuard,
  LogsGuard
} from '@/components/rbac/route-guard'

const Dashboard = React.lazy(() => import('@/app/dashboard/protected-dashboard-components').then(module => ({ default: module.ProtectedUserDashboard })))
const OwnerDashboard = React.lazy(() => import('@/app/dashboard/protected-dashboard-components').then(module => ({ default: module.ProtectedOwnerDashboard })))
const SmartDashboardRouter = React.lazy(() => import('@/app/dashboard/smart-dashboard-router').then(module => ({ default: module.SmartDashboardRouter })))
const Projects = React.lazy(() => import('@/app/projects/projects-page').then(module => ({ default: module.default })))
const Servers = React.lazy(() => import('@/app/servers/servers-page').then(module => ({ default: module.default })))
const UsersManagement = React.lazy(() => import('@/app/management/users-management').then(module => ({ default: module.default })))
const Settings = React.lazy(() => import('@/app/settings/settings-page').then(module => ({ default: module.default })))
const Logs = React.lazy(() => import('@/app/logs/logs-page').then(module => ({ default: module.default })))
const Profile = React.lazy(() => import('@/app/profile/profile-page').then(module => ({ default: module.default })))
const ManagementPage = React.lazy(() => import('@/app/management/management-page').then(module => ({ default: module.default })))
const InviteCodesPage = React.lazy(() => import('@/app/projects/invite-codes-page').then(module => ({ default: module.default })))
const Sessions = React.lazy(() => import('@/app/sessions/sessions-page').then(module => ({ default: module.default })))
const SecurityPage = React.lazy(() => import('@/app/security/security-page').then(module => ({ default: module.default })))
const RemoteControl = React.lazy(() => import('@/app/remote-control/remote-control-page').then(module => ({ default: module.default })))
const Webhooks = React.lazy(() => import('@/app/webhooks/webhooks-page').then(module => ({ default: module.default })))
const NotFoundPage = React.lazy(() => import('@/app/not-found/not-found-page').then(module => ({ default: module.default })))

export function UserLayout() {
  const { user, isInitialized } = useAuthContext()
  const pageConfig = usePageConfig()

  return (
    <AppLayout title={pageConfig.title} headerActions={pageConfig.actions}>
      <AnimatedPage>
        <Suspense fallback={<Spinner fullscreen size="lg" message="Loading page..." />}>
          <Routes>
            <Route path="/" element={<SmartDashboardRouter />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/owner-dashboard" element={
              <OwnerRouteGuard>
                <OwnerDashboard />
              </OwnerRouteGuard>
            } />
            <Route path="/projects" element={
              <ProjectsGuard>
                <Projects />
              </ProjectsGuard>
            } />
            <Route path="/servers" element={
              <ServersGuard>
                <Servers />
              </ServersGuard>
            } />
            <Route path="/users-management" element={
              <UsersManagementGuard>
                <UsersManagement />
              </UsersManagementGuard>
            } />
            <Route path="/settings" element={
              <ProjectSettingsGuard>
                <Settings />
              </ProjectSettingsGuard>
            } />
            <Route path="/logs" element={
              <LogsGuard>
                <Logs />
              </LogsGuard>
            } />
            <Route path="/profile" element={<Profile />} />
            <Route path="/management-page" element={
              <ManagementPageGuard>
                <ManagementPage />
              </ManagementPageGuard>
            } />
            <Route path="/invite-codes" element={<InviteCodesPage />} />
            <Route path="/security" element={
              <AdminRouteGuard>
                <SecurityPage />
              </AdminRouteGuard>
            } />
            <Route path="/remote-control" element={
              <RemoteControlGuard>
                <RemoteControl />
              </RemoteControlGuard>
            } />
            <Route path="/webhooks" element={
              <WebhooksGuard>
                <Webhooks />
              </WebhooksGuard>
            } />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AnimatedPage>
    </AppLayout>
  )
}
