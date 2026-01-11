import React from 'react'
import CreateAgentDialog from './CreateAgentDialog'
import EditAgentDialog from './EditAgentDialog'
import UploadAgentFilesDialog from './UploadAgentFilesDialog'
import ViewAgentDialog from './ViewAgentDialog'
import AgentConfigDialog from './AgentConfigDialog'
import AssignProductsDialog from './AssignProductsDialog'
import LibraryHashManager from './LibraryHashManager'
import { NotificationsDialog } from '@/features/notifications'
import { ChangelogManagementDialog } from '@/features/changelog'
import type { Agent } from '@/entities/agent'
import type { Product } from '@/entities/product'

interface AgentManagerDialogsProps {
  showCreateDialog: boolean
  showEditDialog: boolean
  showUploadDialog: boolean
  showDetailsDialog: boolean
  showConfigDialog: boolean
  showAssignProductsDialog: boolean
  showNotificationsDialog: boolean
  showChangelogDialog: boolean
  showLibraryHashDialog: boolean
  selectedAgent: Agent | null

  canEditAgents: boolean
  canCreateAgents: boolean
  canUploadFiles: boolean
  canViewNotifications: boolean
  canCreateNotifications: boolean
  canEditNotifications: boolean
  canViewChangelog: boolean
  canCreateChangelog: boolean
  canEditChangelog: boolean
  canConfigurationSettings: boolean
  canAssignProducts: boolean

  setShowCreateDialog: (open: boolean) => void
  setShowEditDialog: (open: boolean) => void
  setShowUploadDialog: (open: boolean) => void
  setShowDetailsDialog: (open: boolean) => void
  setShowConfigDialog: (open: boolean) => void
  setShowAssignProductsDialog: (open: boolean) => void
  setShowNotificationsDialog: (open: boolean) => void
  setShowChangelogDialog: (open: boolean) => void
  setShowLibraryHashDialog: (open: boolean) => void
  setSelectedAgent: (agent: Agent | null) => void
  closeAllDialogs: () => void

  onSuccess: () => void
  onAssignProducts: (agentId: number, productIds: number[]) => Promise<void>
  onUnassignProducts: (agentId: number, productIds: number[]) => Promise<void>
}

export function AgentManagerDialogs({
  showCreateDialog,
  showEditDialog,
  showUploadDialog,
  showDetailsDialog,
  showConfigDialog,
  showAssignProductsDialog,
  showNotificationsDialog,
  showChangelogDialog,
  showLibraryHashDialog,
  selectedAgent,
  canEditAgents,
  canCreateAgents,
  canUploadFiles,
  canViewNotifications,
  canCreateNotifications,
  canEditNotifications,
  canViewChangelog,
  canCreateChangelog,
  canEditChangelog,
  canConfigurationSettings,
  canAssignProducts,
  setShowCreateDialog,
  setShowEditDialog,
  setShowUploadDialog,
  setShowDetailsDialog,
  setShowConfigDialog,
  setShowAssignProductsDialog,
  setShowNotificationsDialog,
  setShowChangelogDialog,
  setShowLibraryHashDialog,
  setSelectedAgent,
  closeAllDialogs,
  onSuccess,
  onAssignProducts,
  onUnassignProducts,
}: AgentManagerDialogsProps) {
  return (
    <>
      <ViewAgentDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        agent={selectedAgent}
        onEdit={selectedAgent ? (agent) => {
          setShowDetailsDialog(false);
          setSelectedAgent(agent);
          setShowEditDialog(true);
        } : undefined}
        onUpload={selectedAgent ? (agent) => {
          setShowDetailsDialog(false);
          setSelectedAgent(agent);
          setShowUploadDialog(true);
        } : undefined}
        onNotifications={selectedAgent ? (agent) => {
          setShowDetailsDialog(false);
          setSelectedAgent(agent);
          setShowNotificationsDialog(true);
        } : undefined}
        onChangelog={selectedAgent ? (agent) => {
          setShowDetailsDialog(false);
          setSelectedAgent(agent);
          setShowChangelogDialog(true);
        } : undefined}
        onConfig={selectedAgent ? (agent) => {
          setShowDetailsDialog(false);
          setSelectedAgent(agent);
          setShowConfigDialog(true);
        } : undefined}
        onAssignProducts={selectedAgent ? (agent) => {
          setShowDetailsDialog(false);
          setSelectedAgent(agent);
          setShowAssignProductsDialog(true);
        } : undefined}
        onLibraryHash={selectedAgent ? (agent) => {
          setShowDetailsDialog(false);
          setSelectedAgent(agent);
          setShowLibraryHashDialog(true);
        } : undefined}
        canEdit={canEditAgents}
        canUploadFiles={canUploadFiles}
        canManageNotifications={canViewNotifications || canCreateNotifications}
        canManageChangelog={canViewChangelog || canCreateChangelog}
        canConfigure={canConfigurationSettings}
        canAssignProducts={canAssignProducts}
        onSuccess={onSuccess}
      />

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
          agent={selectedAgent}
          onSuccess={onSuccess}
        />
      )}

      {canConfigurationSettings && (
        <AgentConfigDialog
          open={showConfigDialog}
          onOpenChange={setShowConfigDialog}
          agent={selectedAgent}
          onSuccess={onSuccess}
        />
      )}

      {canAssignProducts && (
        <AssignProductsDialog
          open={showAssignProductsDialog}
          onOpenChange={setShowAssignProductsDialog}
          agent={selectedAgent}
          onAssign={onAssignProducts}
          onUnassign={onUnassignProducts}
          onSuccess={onSuccess}
        />
      )}

      {(canViewNotifications || canCreateNotifications) && (
        <NotificationsDialog
          open={showNotificationsDialog}
          onOpenChange={setShowNotificationsDialog}
          product={selectedAgent as unknown as Product}
          isAgent={true}
        />
      )}

      {(canViewChangelog || canCreateChangelog || canEditChangelog) && (
        <ChangelogManagementDialog
          open={showChangelogDialog}
          onOpenChange={setShowChangelogDialog}
          product={selectedAgent as unknown as Product}
          isAgent={true}
        />
      )}

      {canEditAgents && (
        <LibraryHashManager
          open={showLibraryHashDialog && !!selectedAgent}
          onOpenChange={setShowLibraryHashDialog}
          agentId={selectedAgent?.id}
        />
      )}
    </>
  )
}

