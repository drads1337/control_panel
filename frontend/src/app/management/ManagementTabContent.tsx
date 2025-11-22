import React, { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Plus } from 'lucide-react'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import { useManagementData } from '@/hooks/use-management-data'
import { useProductDialogStore } from '@/stores/product-dialog-store'
import { useAgentDialogStore } from '@/stores/agent-dialog-store'

const LicenseKeysMain = React.lazy(() => import('./license-keys/LicenseKeysMain'))
const ProductDatabase = React.lazy(() => import('./products/ProductDatabase'))
const FileManager = React.lazy(() => import('./files/FileManager'))
const AgentManager = React.lazy(() => import('./agents/AgentManager'))
const NotificationsManager = React.lazy(() => import('./notifications/NotificationsManager'))

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
    canViewProducts,
    canViewAgents,
    canViewNotifications,
    activeTab,
    setActiveTab,
  } = useManagementData()

  const { setCreateProductDialogRequested, createProductDialogRequested } = useProductDialogStore()
  const { setCreateAgentDialogRequested, createAgentDialogRequested } = useAgentDialogStore()

  if (canViewKeys && tabValue === 'license-keys') {
    return (
      <div className="space-y-4">
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading license keys..." /></div>}>
          <LicenseKeysMain 
            onSwitchToProductDatabase={() => setActiveTab('product-database')} 
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
          <FileManager onSwitchToProductDatabase={() => setActiveTab('product-database')} />
        </Suspense>
      </div>
    );
  }

  if (canViewProducts && tabValue === 'product-database') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-0 text-foreground">Products Database</h3>
            <p className="text-muted-foreground">
              Manage the catalog of products, their versions, and settings.
            </p>
          </div>
          <ConditionalRender permission="products.create" fallback={null}>
            <Button 
              onClick={() => setCreateProductDialogRequested(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Products
            </Button>
          </ConditionalRender>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading product database..." /></div>}>
          <ProductDatabase 
            onCreateProductRequested={createProductDialogRequested}
            onCreateProductRequestHandled={() => setCreateProductDialogRequested(false)}
          />
        </Suspense>
      </div>
    );
  }

  if (canViewAgents && tabValue === 'agent-manager') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-0 text-foreground">Agent Management</h3>
            <p className="text-muted-foreground">
              Configure and manage agents for different platforms.
            </p>
          </div>
          <ConditionalRender permission="agents.create" fallback={null}>
            <Button 
              onClick={() => setCreateAgentDialogRequested(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          </ConditionalRender>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading agent manager..." /></div>}>
          <AgentManager 
            onCreateAgentRequested={createAgentDialogRequested}
            onCreateAgentRequestHandled={() => setCreateAgentDialogRequested(false)}
          />
        </Suspense>
      </div>
    );
  }

  if (canViewNotifications && tabValue === 'notifications') {
    return (
      <div className="space-y-4">
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" message="Loading notifications..." /></div>}>
          <NotificationsManager />
        </Suspense>
      </div>
    );
  }

  return null;
}
