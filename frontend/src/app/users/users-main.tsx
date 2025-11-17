import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthContext } from '@/contexts/auth-context';
import { useUsersQuery } from '@/hooks/use-users-query';
import { usePermissions } from '@/hooks/use-permissions';
import UsersStats from './users-stats';
import EmployeesTab from './employees-tab';
import ClientsTab from './clients-tab';
import RBACTab from './rbac-tab';
import ReferralsTab from './referrals-tab';
import { Users, UserCheck, Shield, Key } from 'lucide-react';

const UsersMain: React.FC = () => {
  const { user, isInitialized } = useAuthContext();
  const { 
    users, 
    total,
    loading,
    error,
    statsLoading,
    currentPage,
    perPage,
    deleteUser,
    setPage,
    setPerPage,
    setRoles,
    refetch,
  } = useUsersQuery();

  // State management
  const [activeTab, setActiveTab] = useState('employees');
  
  // Track last fetch parameters to preserve filters when reloading
  const lastFetchParamsRef = useRef<{
    roles?: string[];
    page?: number;
    per_page?: number;
    search?: string;
    role?: string;
    project_id?: number;
  }>({});

  // Wrapper function to track fetch parameters and preserve filters across reloads
  const fetchUsersWithTracking = useCallback(async (params?: {
    roles?: string[];
    page?: number;
    per_page?: number;
    search?: string;
    role?: string;
    project_id?: number;
  }) => {
    const fetchParams = {
      ...lastFetchParamsRef.current,
      ...(params || {}),
      page: params?.page ?? currentPage,
      per_page: params?.per_page ?? perPage,
    };
    
    lastFetchParamsRef.current = { ...fetchParams };
    
    // Update query parameters using React Query hooks
    if (params?.page !== undefined) {
      setPage(params.page);
    }
    if (params?.per_page !== undefined) {
      setPerPage(params.per_page);
    }
    if (params?.roles !== undefined) {
      setRoles(params.roles);
    }
    
    // Refetch data with new parameters
    return refetch();
  }, [setPage, setPerPage, setRoles, refetch, currentPage, perPage]);

  // RBAC permissions
  const { hasPermission } = usePermissions();
  const canViewUsers = hasPermission('employees.view') || hasPermission('clients.view');
  
  // Check permissions for each tab
  const canViewEmployees = hasPermission('employees.view');
  const canViewClients = hasPermission('clients.view');
  const canViewRbac = hasPermission('rbac.view');
  const canViewReferrals = hasPermission('referrals.view');
  
  // Define available tabs based on permissions
  const availableTabs = useMemo(() => {
    const tabs: Array<{
      value: string
      label: string
      icon: React.ComponentType<{ className?: string }>
    }> = []
    if (canViewEmployees) {
      tabs.push({
        value: 'employees',
        label: 'Employees',
        icon: Users
      })
    }
    if (canViewClients) {
      tabs.push({
        value: 'clients',
        label: 'Clients',
        icon: UserCheck
      })
    }
    if (canViewRbac) {
      tabs.push({
        value: 'rbac',
        label: 'RBAC',
        icon: Shield
      })
    }
    if (canViewReferrals) {
      tabs.push({
        value: 'referrals',
        label: 'Referrals',
        icon: Key
      })
    }
    return tabs
  }, [canViewEmployees, canViewClients, canViewRbac, canViewReferrals])
  
  // Ensure active tab is available, otherwise switch to first available tab
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.value === activeTab)) {
      setActiveTab(availableTabs[0].value)
    }
  }, [activeTab, availableTabs])

  // Employee roles filter - used to determine if users without roles are admins
  const employeeRolesFilter = useMemo(() => ['admin', 'seller', 'developer', 'moderator'], []);
  
  // Load users on component mount
  useEffect(() => {
    if (isInitialized && user && canViewEmployees) {
      setRoles(employeeRolesFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, user, canViewEmployees]);

  // Calculate stats - MEMOIZED
  const userStats = useMemo(() => ({
    total: total || 0,
    active: users.length,
    withKeys: users.filter(u => (u.keys_count || 0) > 0).length,
    admins: users.filter(u => u.roles?.includes('admin') || u.roles?.includes('owner')).length
  }), [users, total]);

  // Don't render until auth is initialized
  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Initializing...</div>
        </div>
      </div>
    )
  }

  // Check if user has permission to view users
  if (!canViewUsers) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to view users.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Your roles: {user?.roles?.join(', ') || 'unknown'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Required permissions: employees.view or clients.view
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage employees, clients, roles, and permissions
        </p>
      </div>

      {/* Stats */}
      <UsersStats stats={userStats} loading={statsLoading} />

      {/* Main Tabs */}
      {availableTabs.length > 0 && (
        <>
          {availableTabs.length > 1 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`grid w-full h-14 bg-muted border border-border rounded-lg`} style={{gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)`}}>
                {availableTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <TabsTrigger 
                      key={tab.value}
                      value={tab.value} 
                      className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {/* Employees Tab Content */}
              {canViewEmployees && (
                <TabsContent value="employees" className="space-y-6 mt-4">
                  <EmployeesTab 
                    fetchUsersWithTracking={fetchUsersWithTracking}
                    currentPage={currentPage}
                    perPage={perPage}
                    users={users}
                    loading={loading}
                    error={error}
                    total={total}
                    deleteExistingUser={deleteUser}
                    employeeRolesFilter={employeeRolesFilter}
                  />
                </TabsContent>
              )}

              {/* Clients Tab Content */}
              {canViewClients && (
                <TabsContent value="clients" className="space-y-6 mt-4">
                  <ClientsTab />
                </TabsContent>
              )}

              {/* RBAC Tab Content */}
              {canViewRbac && (
                <TabsContent value="rbac" className="space-y-6 mt-4">
                  <RBACTab />
                </TabsContent>
              )}

              {/* Referrals Tab Content */}
              {canViewReferrals && (
                <TabsContent value="referrals" className="space-y-6 mt-4">
                  <ReferralsTab />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            // Single tab - render content directly without tabs UI
            <>
              {canViewEmployees && activeTab === 'employees' && (
                <div className="space-y-6 mt-4">
                  <EmployeesTab 
                    fetchUsersWithTracking={fetchUsersWithTracking}
                    currentPage={currentPage}
                    perPage={perPage}
                    users={users}
                    loading={loading}
                    error={error}
                    total={total}
                    deleteExistingUser={deleteUser}
                    employeeRolesFilter={employeeRolesFilter}
                  />
                </div>
              )}
              {canViewClients && activeTab === 'clients' && (
                <div className="space-y-6 mt-4">
                  <ClientsTab />
                </div>
              )}
              {canViewRbac && activeTab === 'rbac' && (
                <div className="space-y-6 mt-4">
                  <RBACTab />
                </div>
              )}
              {canViewReferrals && activeTab === 'referrals' && (
                <div className="space-y-6 mt-4">
                  <ReferralsTab />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default UsersMain;
