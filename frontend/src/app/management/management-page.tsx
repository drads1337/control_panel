import React, { useEffect } from 'react';
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs';
import { useAuthContext } from '@/contexts/auth-context';
import { useManagementData } from '@/hooks/use-management-data';
import { useManagementStats } from '@/hooks/use-management-stats';
import { useManagementStore } from '@/stores/management-store';
import { ManagementAccessDenied } from './management-access-denied';
import ManagementStats from './management-stats';
import { ManagementTabContent } from './ManagementTabContent';
import { ManagementDialogs } from './management-dialogs';
import type { Game } from '@/entities/game';

export default function ManagementPage() {
  const { user, isInitialized } = useAuthContext();
  const {
    isAuthenticated,
    hasAccess,
    availableTabs,
    activeTab,
    setActiveTab,
    canViewKeys,
    canViewFiles,
    canViewGames,
    canViewLoaders,
  } = useManagementData();

  const { stats, isLoading: statsLoading } = useManagementStats();

  const {
    openViewGameDialog,
    closeViewGameDialog,
  } = useManagementStore();

  const handleViewGame = (game: Game) => {
    openViewGameDialog(game);
  };

  const handleEditGame = (game: Game) => {
    closeViewGameDialog();
  };

  const handleUploadGame = (game: Game) => {
    closeViewGameDialog();
  };

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.value === activeTab)) {
      setActiveTab(availableTabs[0].value);
    }
  }, [activeTab, availableTabs, setActiveTab]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Initializing...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !hasAccess) {
    return (
      <ManagementAccessDenied
        isAuthenticated={isAuthenticated}
        hasAccess={hasAccess}
        user={user}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">System Management</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive management of licenses, games, files, and loaders
        </p>
      </div>

      {/* Stats */}
      <ManagementStats stats={stats} loading={statsLoading} />

      {/* Tabs */}
      {availableTabs.length > 0 && (
        <>
          {availableTabs.length > 1 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="relative mb-4">
                <TabsList className={`grid w-full h-14 bg-muted border border-border rounded-lg p-1`} style={{gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)`}}>
                  {availableTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger 
                        key={tab.value}
                        value={tab.value} 
                        className="flex items-center justify-center gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <TabsContents>
                {canViewKeys && (
                  <TabsContent value="license-keys" className="space-y-6">
                    <ManagementTabContent 
                      tabValue="license-keys"
                      wrapInTabsContent={false}
                    />
                  </TabsContent>
                )}

                {canViewFiles && (
                  <TabsContent value="file-manager" className="space-y-6">
                    <ManagementTabContent 
                      tabValue="file-manager"
                      wrapInTabsContent={false}
                    />
                  </TabsContent>
                )}

                {canViewGames && (
                  <TabsContent value="game-database" className="space-y-6">
                    <ManagementTabContent 
                      tabValue="game-database"
                      wrapInTabsContent={false}
                    />
                  </TabsContent>
                )}

                {canViewLoaders && (
                  <TabsContent value="loader-manager" className="space-y-6">
                    <ManagementTabContent 
                      tabValue="loader-manager"
                      wrapInTabsContent={false}
                    />
                  </TabsContent>
                )}
              </TabsContents>
            </Tabs>
          ) : (
            <>
              {canViewKeys && activeTab === 'license-keys' && (
                <div className="space-y-6 mt-4">
                  <ManagementTabContent 
                    tabValue="license-keys"
                    wrapInTabsContent={false}
                  />
                </div>
              )}
              {canViewFiles && activeTab === 'file-manager' && (
                <div className="space-y-6 mt-4">
                  <ManagementTabContent 
                    tabValue="file-manager"
                    wrapInTabsContent={false}
                  />
                </div>
              )}
              {canViewGames && activeTab === 'game-database' && (
                <div className="space-y-6 mt-4">
                  <ManagementTabContent 
                    tabValue="game-database"
                    wrapInTabsContent={false}
                  />
                </div>
              )}
              {canViewLoaders && activeTab === 'loader-manager' && (
                <div className="space-y-6 mt-4">
                  <ManagementTabContent 
                    tabValue="loader-manager"
                    wrapInTabsContent={false}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      <ManagementDialogs onEditGame={handleEditGame} onUploadGame={handleUploadGame} />
    </div>
  );
}