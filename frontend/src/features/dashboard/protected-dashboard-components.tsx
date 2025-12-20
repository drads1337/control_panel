import React from 'react'
import { withAuthGuard, withOwnerGuard } from '@/components/hoc/with-role-guard'
import { AdminDashboardPage } from './admin/admin-dashboard-page'
import { DashboardPage } from './owner/dashboard-page'

export const ProtectedUserDashboard = withAuthGuard(() => (
  <AdminDashboardPage type="user" />
))

export const ProtectedOwnerDashboard = withOwnerGuard(() => (
  <DashboardPage type="owner" />
))
