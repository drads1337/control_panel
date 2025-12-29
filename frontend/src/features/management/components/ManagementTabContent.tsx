import React, { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Plus } from 'lucide-react'
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render'
import { useManagementData } from '@/features/user-administration/hooks/use-management-data'
import { useProductDialogStore } from '@/shared/model/use-product-dialog-store'
import { useAgentDialogStore } from '@/shared/model/use-agent-dialog-store'

const LicenseKeysMain = React.lazy(() => import('@/features/license-keys').then((module) => ({ default: module.LicenseKeysMain })))
const ProductDatabase = React.lazy(() => 
  import('@/features/product-management/ProductDatabase').catch((error) => {
    console.error('Failed to load ProductDatabase:', error);
    throw error;
  })
)
const FileManager = React.lazy(() => import('@/features/file-manager').then((module) => ({ default: module.FileManager })))
const AgentManager = React.lazy(() => import('@/features/agent-management').then((module) => ({ default: module.AgentManager })))

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
    activeTab,
    setActiveTab,
  } = useManagementData()

  const { setCreateProductDialogRequested, createProductDialogRequested } = useProductDialogStore()
  const { setCreateAgentDialogRequested, createAgentDialogRequested } = useAgentDialogStore()

  if (canViewKeys && tabValue === 'license-keys') {
    return (
      <div className="space-y-3 sm:space-y-4">
        <Suspense fallback={<div className="flex flex-col items-center justify-center gap-2 min-h-[250px] sm:min-h-[400px]"><Spinner size="lg" /><span className="text-sm text-muted-foreground">Loading license keys...</span></div>}>
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
      <div className="space-y-3 sm:space-y-4">
        <Suspense fallback={<div className="flex flex-col items-center justify-center gap-2 min-h-[250px] sm:min-h-[400px]"><Spinner size="lg" /><span className="text-sm text-muted-foreground">Loading file manager...</span></div>}>
          <FileManager />
        </Suspense>
      </div>
    );
  }

  if (canViewProducts && tabValue === 'product-database') {
    return (
      <div className="space-y-3 sm:space-y-4">
        <Suspense fallback={<div className="flex flex-col items-center justify-center gap-2 min-h-[250px] sm:min-h-[400px]"><Spinner size="lg" /><span className="text-sm text-muted-foreground">Loading product database...</span></div>}>
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
      <div className="space-y-3 sm:space-y-4">
        <Suspense fallback={<div className="flex flex-col items-center justify-center gap-2 min-h-[250px] sm:min-h-[400px]"><Spinner size="lg" /><span className="text-sm text-muted-foreground">Loading agent manager...</span></div>}>
          <AgentManager 
            onCreateAgentRequested={createAgentDialogRequested}
            onCreateAgentRequestHandled={() => setCreateAgentDialogRequested(false)}
          />
        </Suspense>
      </div>
    );
  }

  return null;
}

