import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthContext } from '@/app/providers/auth-provider'
import { usePageConfig } from '@/lib/hooks'
import { AppLayout } from "@/widgets/layout"
import { AnimatedPage } from "@/components/shared/page-transition"
import { Spinner } from '@/components/ui/spinner'
import { PageErrorBoundary } from '@/widgets/page-error-boundary'
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
} from "@/app/routes/route-guard"

const Dashboard = React.lazy(() => import("@/features/dashboard/protected-dashboard-components").then(module => ({ default: module.ProtectedUserDashboard })))
const OwnerDashboard = React.lazy(() => import("@/features/dashboard/protected-dashboard-components").then(module => ({ default: module.ProtectedOwnerDashboard })))
const SmartDashboardRouter = React.lazy(() => import("@/app/routes/smart-dashboard-router").then(module => ({ default: module.SmartDashboardRouter })))
const Projects = React.lazy(() => import("@/pages/projects/projects-page").then(module => ({ default: module.default })))
const Servers = React.lazy(() => import("@/pages/servers/servers-page").then(module => ({ default: module.default })))
const UsersManagement = React.lazy(() => import("@/app/management/users-management").then(module => ({ default: module.default })))
const Settings = React.lazy(() => import("@/pages/settings/settings-page").then(module => ({ default: module.default })))
const Logs = React.lazy(() => import("@/pages/logs/logs-page").then(module => ({ default: module.default })))
const Profile = React.lazy(() => import("@/pages/profile/profile-page").then(module => ({ default: module.default })))
const ManagementPage = React.lazy(() => import("@/pages/management/management-page").then(module => ({ default: module.default })))
const InviteCodesPage = React.lazy(() => import("@/pages/projects/invite-codes-page").then(module => ({ default: module.default })))
const Sessions = React.lazy(() => import("@/pages/sessions/sessions-page").then(module => ({ default: module.default })))
const SecurityPage = React.lazy(() => import("@/pages/security/security-page").then(module => ({ default: module.default })))
const RemoteControl = React.lazy(() => import('@/pages/remote-control/remote-control-page').then(module => ({ default: module.default })))
const Webhooks = React.lazy(() => import("@/pages/webhooks/webhooks-page").then(module => ({ default: module.default })))
const NotFoundPage = React.lazy(() => import('@/pages/not-found/not-found-page').then(module => ({ default: module.default })))

export function UserLayout() {
  const { user, isInitialized } = useAuthContext()
  const pageConfig = usePageConfig()

  return (
    <AppLayout title={pageConfig.title} headerActions={pageConfig.actions}>
      <AnimatedPage>
        <Suspense fallback={<Spinner fullscreen size="lg" message="Loading page..." />}>
          <Routes>
            <Route path="/" element={
              <PageErrorBoundary pageName="Dashboard">
                <SmartDashboardRouter />
              </PageErrorBoundary>
            } />
            <Route path="/dashboard" element={
              <AnalyticsGuard fallbackPath="/profile">
                <PageErrorBoundary pageName="Dashboard">
                  <Dashboard />
                </PageErrorBoundary>
              </AnalyticsGuard>
            } />
            <Route path="/owner-dashboard" element={
              <OwnerRouteGuard>
                <PageErrorBoundary pageName="Owner Dashboard">
                  <OwnerDashboard />
                </PageErrorBoundary>
              </OwnerRouteGuard>
            } />
            <Route path="/projects" element={
              <ProjectsGuard>
                <PageErrorBoundary pageName="Projects">
                  <Projects />
                </PageErrorBoundary>
              </ProjectsGuard>
            } />
            <Route path="/servers" element={
              <ServersGuard>
                <PageErrorBoundary pageName="Servers">
                  <Servers />
                </PageErrorBoundary>
              </ServersGuard>
            } />
            <Route path="/users-management" element={
              <UsersManagementGuard>
                <PageErrorBoundary pageName="Users Management">
                  <UsersManagement />
                </PageErrorBoundary>
              </UsersManagementGuard>
            } />
            <Route path="/settings" element={
              <ProjectSettingsGuard>
                <PageErrorBoundary pageName="Settings">
                  <Settings />
                </PageErrorBoundary>
              </ProjectSettingsGuard>
            } />
            <Route path="/logs" element={
              <LogsGuard>
                <PageErrorBoundary pageName="Logs">
                  <Logs />
                </PageErrorBoundary>
              </LogsGuard>
            } />
            <Route path="/profile" element={
              <PageErrorBoundary pageName="Profile">
                <Profile />
              </PageErrorBoundary>
            } />
            <Route path="/management-page" element={
              <ManagementPageGuard>
                <PageErrorBoundary pageName="Management">
                  <ManagementPage />
                </PageErrorBoundary>
              </ManagementPageGuard>
            } />
            <Route path="/invite-codes" element={
              <PageErrorBoundary pageName="Invite Codes">
                <InviteCodesPage />
              </PageErrorBoundary>
            } />
            <Route path="/security" element={
              <AdminRouteGuard>
                <PageErrorBoundary pageName="Security">
                  <SecurityPage />
                </PageErrorBoundary>
              </AdminRouteGuard>
            } />
            <Route path="/remote-control" element={
              <RemoteControlGuard>
                <PageErrorBoundary pageName="Remote Control">
                  <RemoteControl />
                </PageErrorBoundary>
              </RemoteControlGuard>
            } />
            <Route path="/webhooks" element={
              <WebhooksGuard>
                <PageErrorBoundary pageName="Webhooks">
                  <Webhooks />
                </PageErrorBoundary>
              </WebhooksGuard>
            } />
            <Route path="*" element={
              <PageErrorBoundary pageName="Page">
                <NotFoundPage />
              </PageErrorBoundary>
            } />
          </Routes>
        </Suspense>
      </AnimatedPage>
    </AppLayout>
  )
}
