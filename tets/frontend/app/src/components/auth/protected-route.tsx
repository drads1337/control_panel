import { Navigate, Outlet } from 'react-router-dom';
import { api } from '@/lib/api';

export function ProtectedRoute() {
  if (!api.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}