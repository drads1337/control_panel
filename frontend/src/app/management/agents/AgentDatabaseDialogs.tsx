import React from 'react'
import CreateAgentDialog from './CreateAgentDialog'
import EditAgentDialog from './EditAgentDialog'
import UploadAgentFilesDialog from './UploadAgentFilesDialog'
import AgentDetailsDialog from './AgentDetailsDialog'
import AgentConfigDialog from './AgentConfigDialog'
import AssignProductsDialog from './AssignProductsDialog'
import NotificationsDialog from '../notifications/NotificationsDialog'
import ChangelogManagementDialog from '../changelog/ChangelogManagementDialog'
import type { Agent } from '@/entities/agent'
import type { Product } from '@/entities/product'

interface AgentDatabaseDialogsProps {
  showCreateDialog: boolean
  showEditDialog: boolean
  showUploadDialog: boolean
  showDetailsDialog: boolean
  showConfigDialog: boolean
  showAssignProductsDialog: boolean
  showNotificationsDialog: boolean
  showChangelogDialog: boolean
  selectedAgent: Agent | null
  products: Product[]
  canCreateAgents: boolean
  canEditAgents: boolean
  canUploadFiles: boolean
  canConfigurationSettings: boolean
  canAssignProducts: boolean
  canViewNotifications: boolean
  canCreateNotifications: boolean
  canViewChangelog: boolean
  canCreateChangelog: boolean
  setShowCreateDialog: (open: boolean) => void
  setShowEditDialog: (open: boolean) => void
  setShowUploadDialog: (open: boolean) => void
  setShowDetailsDialog: (open: boolean) => void
  setShowConfigDialog: (open: boolean) => void
  setShowAssignProductsDialog: (open: boolean) => void
  setShowNotificationsDialog: (open: boolean) => void
  setShowChangelogDialog: (open: boolean) => void
  onSuccess: () => void
  onAssignProducts: (agentId: number, productIds: number[]) => Promise<void>
  onUnassignProducts: (agentId: number, productIds: number[]) => Promise<void>
}

export function AgentDatabaseDialogs({
  showCreateDialog,
  showEditDialog,
  showUploadDialog,
  showDetailsDialog,
  showConfigDialog,
  showAssignProductsDialog,
  showNotificationsDialog,
  showChangelogDialog,
  selectedAgent,
  products,
  canCreateAgents,
  canEditAgents,
  canUploadFiles,
  canConfigurationSettings,
  canAssignProducts,
  canViewNotifications,
  canCreateNotifications,
  canViewChangelog,
  canCreateChangelog,
  setShowCreateDialog,
  setShowEditDialog,
  setShowUploadDialog,
  setShowDetailsDialog,
  setShowConfigDialog,
  setShowAssignProductsDialog,
  setShowNotificationsDialog,
  setShowChangelogDialog,
  onSuccess,
  onAssignProducts,
  onUnassignProducts,
}: AgentDatabaseDialogsProps) {
  return (
    <>
      {canCreateAgents && (
        <CreateAgentDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={onSuccess}
        />
      )}
      {canEditAgents && (
        <EditAgentDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={onSuccess}
          agent={selectedAgent}
        />
      )}
      {canUploadFiles && (
        <UploadAgentFilesDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          onSuccess={onSuccess}
          agent={selectedAgent}
        />
      )}
      <AgentDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        agent={selectedAgent}
        products={products}
      />
      {canConfigurationSettings && (
        <AgentConfigDialog
          open={showConfigDialog}
          onOpenChange={setShowConfigDialog}
          onSuccess={onSuccess}
          agent={selectedAgent}
        />
      )}
      {canAssignProducts && (
        <AssignProductsDialog
          open={showAssignProductsDialog}
          onOpenChange={setShowAssignProductsDialog}
          agent={selectedAgent}
          onAssign={onAssignProducts}
          onUnassign={onUnassignProducts}
        />
      )}
      {(canViewNotifications || canCreateNotifications) && selectedAgent && (
        <NotificationsDialog
          key="agent-notifications-dialog"
          open={showNotificationsDialog}
          onOpenChange={setShowNotificationsDialog}
          product={{
            id: selectedAgent.id,
            name: selectedAgent.name,
            is_multi_app: false,
          } as Product}
          isAgent={true}
        />
      )}
      {canViewChangelog && selectedAgent && (
        <ChangelogManagementDialog
          key="agent-changelog-dialog"
          open={showChangelogDialog}
          onOpenChange={setShowChangelogDialog}
          product={{
            id: selectedAgent.id,
            name: selectedAgent.name,
            is_multi_app: false,
          } as Product}
          isAgent={true}
        />
      )}
    </>
  )
}

