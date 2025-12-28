import React, { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuthContext } from '@/app/providers/auth-provider';
import { useManagementData } from '@/features/user-administration/hooks/use-management-data';
import { useManagementStats } from '@/features/user-administration/hooks/use-management-stats';
import { AccessDenied } from '@/shared/ui/components';
import { ManagementStats } from './components/ManagementStats';
import { ManagementTabContent } from './components/ManagementTabContent';
import { ManagementDialogs } from './components/ManagementDialogs';

export function ManagementPage() {
  const { user, isInitialized, isAuthenticated: authIsAuthenticated, isLoading } = useAuthContext();
  const {
    hasAccess,
    availableTabs,
    activeTab,
    setActiveTab,
    canViewKeys,
    canViewFiles,
    canViewProducts,
    canViewAgents,
  } = useManagementData();

  const { stats, isLoading: statsLoading } = useManagementStats();

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.value === activeTab)) {
      setActiveTab(availableTabs[0].value);
    }
  }, [activeTab, availableTabs, setActiveTab]);

  // Use user directly to check authentication instead of isAuthenticated from useManagementData
  const isAuthenticated = !!user && authIsAuthenticated;

  // Debug logging
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[ManagementPage] Debug Info:', {
        isInitialized,
        isLoading,
        user: user ? { id: user.id, email: user.email, roles: user.roles, rbac_roles: user.rbac_roles } : null,
        authIsAuthenticated,
        isAuthenticated,
        hasAccess,
        canViewKeys,
        canViewFiles,
        canViewProducts,
        canViewAgents,
        availableTabsCount: availableTabs.length,
        userPermissions: user?.permissions || [],
      });
    }
  }, [isInitialized, isLoading, user, authIsAuthenticated, isAuthenticated, hasAccess, canViewKeys, canViewFiles, canViewProducts, canViewAgents, availableTabs]);

  // Show loading if not initialized or still loading
  // Trust the auth context - if it says user is null after initialization, that's the truth
  if (!isInitialized || isLoading) {
    if (import.meta.env.DEV) {
      console.log('[ManagementPage] Not ready yet:', { 
        isInitialized, 
        isLoading, 
        hasUser: !!user,
      });
    }
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Initializing...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !hasAccess) {
    if (import.meta.env.DEV) {
      console.warn('[ManagementPage] Access denied:', {
        isAuthenticated,
        hasAccess,
        reason: !isAuthenticated ? 'not authenticated' : 'no access',
        user: user ? { id: user.id, email: user.email } : null,
      });
    }
    return (
      <AccessDenied
        isAuthenticated={isAuthenticated}
        hasAccess={hasAccess}
        user={user}
        notAuthenticatedMessage="You need to be logged in to access the management panel."
        noPermissionMessage="You don't have permission to access the management panel."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
          <div className="px-4 lg:px-6">
            <ManagementStats stats={stats} loading={statsLoading} />
          </div>
          {availableTabs.length > 0 && (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full flex-col justify-start gap-4"
            >
              <div className="flex items-center justify-between px-4 lg:px-6">
                <Label htmlFor="view-selector" className="sr-only">
                  View
                </Label>
                <Select value={activeTab} onValueChange={setActiveTab}>
                  <SelectTrigger
                    className="flex w-fit h-7 text-xs @4xl/main:hidden"
                    size="sm"
                    id="view-selector"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {availableTabs.map((tab) => (
                      <SelectItem key={tab.value} value={tab.value} className="text-xs">
                        {tab.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden h-8 **:data-[slot=badge]:size-4 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 **:data-[slot=tabs-trigger]:text-xs @4xl/main:flex">
                  {availableTabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {canViewKeys && (
                <TabsContent
                  value="license-keys"
                  className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
                >
                  <ManagementTabContent 
                    tabValue="license-keys"
                    wrapInTabsContent={false}
                  />
                </TabsContent>
              )}
              {canViewFiles && (
                <TabsContent
                  value="file-manager"
                  className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
                >
                  <ManagementTabContent 
                    tabValue="file-manager"
                    wrapInTabsContent={false}
                  />
                </TabsContent>
              )}
              {canViewProducts && (
                <TabsContent
                  value="product-database"
                  className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
                >
                  <ManagementTabContent 
                    tabValue="product-database"
                    wrapInTabsContent={false}
                  />
                </TabsContent>
              )}
              {canViewAgents && (
                <TabsContent
                  value="agent-manager"
                  className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
                >
                  <ManagementTabContent 
                    tabValue="agent-manager"
                    wrapInTabsContent={false}
                  />
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </div>
      <ManagementDialogs />
    </div>
  );
}
