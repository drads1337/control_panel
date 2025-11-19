import React, { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Plus } from 'lucide-react'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import { useManagementData } from '@/hooks/use-management-data'
import { useManagementStore } from '@/stores/management-store'

const LicenseKeysMain = React.lazy(() => import('./license-keys').then(module => ({ default: module.LicenseKeysMain })))
const GameDatabase = React.lazy(() => import('./games').then(module => ({ default: module.GameDatabase })))
const FileManager = React.lazy(() => import('./files').then(module => ({ default: module.FileManager })))
const LoaderManager = React.lazy(() => import('./loaders').then(module => ({ default: module.LoaderManager })))

interface ManagementTabContentProps {
  tabValue: string
  wrapInTabsContent?: boolean
}

export const ManagementTabContent: React.FC<ManagementTabContentProps> = ({
  tabValue,
  wrapInTabsContent = false,
}) => {
  const {
    canViewKeys,
    canViewFiles,
    canViewGames,
    canViewLoaders,
    activeTab,
    setActiveTab,
  } = useManagementData()

  const {
    dialogs,
    setCreateGameDialogRequested,
    setCreateLoaderDialogRequested,
    openViewGameDialog,
  } = useManagementStore()

  const { createGameDialogRequested, createLoaderDialogRequested } = dialogs

  if (canViewKeys && tabValue === 'license-keys') {
    return (
      <div className="space-y-4">
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading license keys..." /></div>}>
          <LicenseKeysMain 
            onSwitchToGameDatabase={() => setActiveTab('game-database')} 
            activeTab={activeTab}
          />
        </Suspense>
      </div>
    );
  }

  if (canViewFiles && tabValue === 'file-manager') {
    return (
      <div className="space-y-4">
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading file manager..." /></div>}>
          <FileManager onSwitchToGameDatabase={() => setActiveTab('game-database')} />
        </Suspense>
      </div>
    );
  }

  if (canViewGames && tabValue === 'game-database') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-0 text-foreground">Applications Database</h3>
            <p className="text-muted-foreground">
              Manage the catalog of applications, their versions, and settings.
            </p>
          </div>
          <ConditionalRender permission="games.create" fallback={null}>
            <Button 
              onClick={() => setCreateGameDialogRequested(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Application
            </Button>
          </ConditionalRender>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading game database..." /></div>}>
          <GameDatabase 
            onViewGame={openViewGameDialog} 
            onCreateGameRequested={createGameDialogRequested}
            onCreateGameRequestHandled={() => setCreateGameDialogRequested(false)}
          />
        </Suspense>
      </div>
    );
  }

  if (canViewLoaders && tabValue === 'loader-manager') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-0 text-foreground">Loader Management</h3>
            <p className="text-muted-foreground">
              Configure and manage loaders for different platforms.
            </p>
          </div>
          <ConditionalRender permission="loaders.create" fallback={null}>
            <Button 
              onClick={() => setCreateLoaderDialogRequested(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Loader
            </Button>
          </ConditionalRender>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading loader manager..." /></div>}>
          <LoaderManager 
            onCreateLoaderRequested={createLoaderDialogRequested}
            onCreateLoaderRequestHandled={() => setCreateLoaderDialogRequested(false)}
          />
        </Suspense>
      </div>
    );
  }

  return null;
}
