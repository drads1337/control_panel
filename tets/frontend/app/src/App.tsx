import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthenticatedLayout } from './components/layout/authenticated-layout'
import { DashboardPage } from './page/dashboard/dashboard-page'
import { LoginPage } from './page/auth/login-page'
import { SignUpPage } from './page/auth/signup-page'
import { ProtectedRoute } from './components/auth/protected-route'
import { Toaster } from './components/ui/sonner'
// Fleet Management
import { FleetListPage } from './page/fleet/fleet-list-page'
import { FleetDetailPage } from './page/fleet/fleet-detail-page'
import { FleetFormPage } from './page/fleet/fleet-form-page'
// Driver Management
import { DriverListPage } from './page/drivers/driver-list-page'
import { DriverFormPage } from './page/drivers/driver-form-page'
// Dispatch
import { DispatchBoardPage } from './page/dispatch/dispatch-board-page'
// Tracking
import { TrackingPage } from './page/tracking/tracking-page'
// Financial
import { FinancialPage } from './page/financial/financial-page'
// Phase 2
import { HOSPage } from './page/hos/hos-page'
import { RoutesPage } from './page/routes/routes-page'
import { AnalyticsPage } from './page/analytics/analytics-page'
import { MaintenancePage } from './page/maintenance/maintenance-page'
import { FuelPage } from './page/fuel/fuel-page'
import { CompliancePage } from './page/compliance/compliance-page'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route element={<AuthenticatedLayout />}>
            <Route index element={<DashboardPage />} />
            {/* Fleet Management */}
            <Route path="fleet" element={<FleetListPage />} />
            <Route path="fleet/new" element={<FleetFormPage />} />
            <Route path="fleet/:id" element={<FleetDetailPage />} />
            <Route path="fleet/:id/edit" element={<FleetFormPage />} />
            {/* Driver Management */}
            <Route path="drivers" element={<DriverListPage />} />
            <Route path="drivers/new" element={<DriverFormPage />} />
            <Route path="drivers/:id/edit" element={<DriverFormPage />} />
            {/* Dispatch */}
            <Route path="dispatch" element={<DispatchBoardPage />} />
            {/* Tracking */}
            <Route path="tracking" element={<TrackingPage />} />
            {/* Financial */}
            <Route path="financial" element={<FinancialPage />} />
            {/* Phase 2 Features */}
            <Route path="hos" element={<HOSPage />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="fuel" element={<FuelPage />} />
            <Route path="compliance" element={<CompliancePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App