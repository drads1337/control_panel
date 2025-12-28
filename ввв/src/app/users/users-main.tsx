import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs';
import { useAuthContext } from '@/contexts/auth-context';
import { useUsersQuery } from '@/entities/user';
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

  const [activeTab, setActiveTab] = useState('employees');

  const lastFetchParamsRef = useRef<{
    roles?: string[];
    page?: number;
    per_page?: number;
    search?: string;
    role?: string;
    project_id?: number;
  }>({});

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

    if (params?.page !== undefined) {
      setPage(params.page);
    }
    if (params?.per_page !== undefined) {
      setPerPage(params.per_page);
    }
    if (params?.roles !== undefined) {
      setRoles(params.roles);
    }

    return refetch();
  }, [setPage, setPerPage, setRoles, refetch, currentPage, perPage]);

  const { hasPermission } = usePermissions();
  const canViewUsers = hasPermission('employees.view') || hasPermission('clients.view');

  const canViewEmployees = hasPermission('employees.view');
  const canViewClients = hasPermission('clients.view');
  const canViewRbac = hasPermission('rbac.view');
  const canViewReferrals = hasPermission('referrals.view');

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

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.value === activeTab)) {
      setActiveTab(availableTabs[0].value)
    }
  }, [activeTab, availableTabs])

  const employeeRolesFilter = useMemo(() => ['admin', 'seller', 'developer', 'moderator'], []);

  useEffect(() => {
    if (isInitialized && user && canViewEmployees) {
      setRoles(employeeRolesFilter);
    }

  }, [isInitialized, user, canViewEmployees]);

  const userStats = useMemo(() => ({
    total: total || 0,
    active: users.length,
    withKeys: users.filter(u => (u.keys_count || 0) > 0).length,
    admins: users.filter(u => u.roles?.includes('admin') || u.roles?.includes('owner')).length
  }), [users, total]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Initializing...</div>
        </div>
      </div>
    )
  }

  if (!canViewUsers) {
    return (
      <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 px-2 xs:px-3 sm:px-4 md:px-0">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-lg xs:text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-sm xs:text-base text-muted-foreground">
              You don't have permission to view users.
            </p>
            <p className="text-xs xs:text-sm text-muted-foreground mt-2">
              Your roles: {user?.roles?.join(', ') || 'unknown'}
            </p>
            <p className="text-xs xs:text-sm text-muted-foreground mt-1">
              Required permissions: employees.view or clients.view
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-2 sm:px-0">
      {}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">User Management</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-snug">
          Manage employees, clients, roles, and permissions
        </p>
      </div>

      {}
      <UsersStats stats={userStats} loading={statsLoading} />

      {}
      {availableTabs.length > 0 && (
        <>
          {availableTabs.length > 1 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="relative mb-3 xs:mb-4">
                <TabsList className={`grid w-full h-12 xs:h-14 bg-muted border border-border rounded-lg p-1`} style={{gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)`}}>
                  {availableTabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <TabsTrigger 
                        key={tab.value}
                        value={tab.value} 
                        className="flex items-center justify-center gap-2"
                      >
                        <Icon className="h-4 w-4 md:h-4 md:w-4" />
                        <span className="hidden md:inline">{tab.label}</span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              <TabsContents>
                {canViewEmployees && (
                  <TabsContent value="employees" className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
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

                {canViewClients && (
                  <TabsContent value="clients" className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
                    <ClientsTab />
                  </TabsContent>
                )}

                {canViewRbac && (
                  <TabsContent value="rbac" className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
                    <RBACTab />
                  </TabsContent>
                )}

                {canViewReferrals && (
                  <TabsContent value="referrals" className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
                    <ReferralsTab />
                  </TabsContent>
                )}
              </TabsContents>
            </Tabs>
          ) : (

            <>
              {canViewEmployees && activeTab === 'employees' && (
                <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 mt-3 xs:mt-4">
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
                <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 mt-3 xs:mt-4">
                  <ClientsTab />
                </div>
              )}
              {canViewRbac && activeTab === 'rbac' && (
                <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 mt-3 xs:mt-4">
                  <RBACTab />
                </div>
              )}
              {canViewReferrals && activeTab === 'referrals' && (
                <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 mt-3 xs:mt-4">
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
