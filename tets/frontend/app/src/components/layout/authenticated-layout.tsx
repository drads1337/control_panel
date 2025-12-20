import { Outlet } from 'react-router-dom';
import { AppSidebar } from './app-sidebar';

export function AuthenticatedLayout() {
  return (
    <AppSidebar>
      <Outlet />
    </AppSidebar>
  );
}

