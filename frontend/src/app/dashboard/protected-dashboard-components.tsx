import React from 'react'
import { withAuthGuard, withOwnerGuard } from '@/components/hoc/with-role-guard'
import { DashboardPageWrapper } from './dashboard-page-wrapper'
import { OwnerDashboardPage } from '@/app/owner-dashboard'

export const ProtectedUserDashboard = withAuthGuard(() => (
  <DashboardPageWrapper type="user" />
))

export const ProtectedOwnerDashboard = withOwnerGuard(() => (
  <OwnerDashboardPage />
))
