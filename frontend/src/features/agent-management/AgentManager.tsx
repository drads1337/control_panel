"use client"

import * as React from "react"
import { useEffect } from "react"
import { 
  Plus, 
  MoreVertical, 
  Edit, 
  Upload, 
  Bell, 
  Trash2, 
  Eye,
  Container,
  Settings,
  Database,
  GitCommit,
} from 'lucide-react';

// Hooks
import { useAgentsQuery } from '@/entities/agent';
import { useAgentPermissions, useAgentDialogs, useAgentFilters, useAgentMutations } from './hooks';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { AgentDatabaseEmptyState, AgentDatabaseErrorState, AgentDatabaseAccessDenied } from './components';
import { AgentManagerDialogs } from './components/AgentManagerDialogs';
import type { Agent } from '@/entities/agent';
import { cn } from '@/lib/utils';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AgentManagerProps {
  onCreateAgentRequested?: boolean;
  onCreateAgentRequestHandled?: () => void;
}

export default function AgentManager({ 
  onCreateAgentRequested,
  onCreateAgentRequestHandled,
}: AgentManagerProps) {
  const {
    canViewAgents,
    canCreateAgents,
    canEditAgents,
    canDeleteAgents,
    canUploadFiles,
    canViewNotifications,
    canCreateNotifications,
    canEditNotifications,
    canViewChangelog,
    canCreateChangelog,
    canEditChangelog,
    canManageStatus,
    canAssignProducts,
    canConfigurationSettings,
    hasAnyAgentPermission,
  } = useAgentPermissions();

  const {
    agents,
    products,
    loading,
    error,
    assignProducts: assignProductsMutation,
    unassignProducts: unassignProductsMutation,
    refetch,
    refetchStats,
  } = useAgentsQuery();

  const { handleStatusChange, handleDeleteAgent } = useAgentMutations();
  
  const {
    showCreateDialog,
    showEditDialog,
    showUploadDialog,
    showDetailsDialog,
    showConfigDialog,
    showAssignProductsDialog,
    showNotificationsDialog,
    showChangelogDialog,
    selectedAgent,
    openCreateDialog,
    openEditDialog,
    openUploadDialog,
    openDetailsDialog,
    openConfigDialog,
    openAssignProductsDialog,
    openNotificationsDialog,
    openChangelogDialog,
    closeAllDialogs,
    setShowCreateDialog,
    setShowEditDialog,
    setShowUploadDialog,
    setShowDetailsDialog,
    setShowConfigDialog,
    setShowAssignProductsDialog,
    setShowNotificationsDialog,
    setShowChangelogDialog,
    setSelectedAgent,
  } = useAgentDialogs();

  const handleViewDetails = (agent: Agent) => openDetailsDialog(agent);
  const handleEditAgent = (agent: Agent) => openEditDialog(agent);
  const handleUploadAgent = (agent: Agent) => openUploadDialog(agent);
  const handleConfigAgent = (agent: Agent) => openConfigDialog(agent);
  const handleAssignProductsAgent = (agent: Agent) => openAssignProductsDialog(agent);
  const handleNotificationsAgent = (agent: Agent) => openNotificationsDialog(agent);
  const handleChangelogAgent = (agent: Agent) => openChangelogDialog(agent);

  useEffect(() => {
    if (onCreateAgentRequested) {
      openCreateDialog();
      onCreateAgentRequestHandled?.();
    }
  }, [onCreateAgentRequested, onCreateAgentRequestHandled, openCreateDialog]);

  const { filteredAgents } = useAgentFilters(agents);

  if (!hasAnyAgentPermission) {
    return <AgentDatabaseAccessDenied />;
  }

  if (error) {
    return <AgentDatabaseErrorState error={error} onRetry={refetch} />;
  }
  
  if (!loading && filteredAgents.length === 0 && agents.length === 0) {
    return <AgentDatabaseEmptyState onCreateAgent={() => setShowCreateDialog(true)} canCreateAgents={canCreateAgents} />;
  }

  return (
    <div className="flex flex-col h-[550px] bg-background border rounded-lg shadow-sm overflow-hidden animate-in fade-in duration-300 font-sans">
      
      {/* Header & Controls */}
      <div className="p-3 border-b border-muted-foreground/20 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Database</h2>
        </div>
        <ConditionalRender permission="agents.create" fallback={null}>
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            className="h-8 text-xs gap-1.5"
          >
            <Plus className="size-3" /> New Agent
          </Button>
        </ConditionalRender>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex justify-center items-center flex-1">
            <Spinner />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="rounded-lg border bg-background">
              <Table>
                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                  <TableRow className="h-9 hover:bg-transparent border-b-muted-foreground/10">
                    <TableHead className="text-xs h-9 font-medium text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs h-9 font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs h-9 font-medium text-muted-foreground">Version</TableHead>
                    <TableHead className="text-xs h-9 font-medium text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.length > 0 ? (
                    filteredAgents.map((agent: Agent) => {
                      const statusType = agent.status as StatusType;
                      return (
                        <TableRow
                          key={agent.id}
                          className="h-12 text-xs border-b-muted-foreground/5 hover:bg-background hover:shadow-sm transition-all cursor-pointer"
                          onClick={() => handleViewDetails(agent)}
                        >
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted/20">
                                {agent.logo ? (
                                  <img src={agent.logo} alt={agent.name} className="w-5 h-5 rounded" />
                                ) : (
                                  <Container className="size-3.5 text-muted-foreground" />
                                )}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-foreground leading-tight">{agent.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {agent.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className={cn(getStatusClasses(statusType), "rounded-none")}>
                              {getStatusText(statusType)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className={cn(getStatusClasses('inactive' as StatusType), "rounded-none text-xs font-medium")}>
                              v{agent.version || '0.0.0'}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                  >
                                    <MoreVertical className="size-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => handleViewDetails(agent)}>
                                    <Eye className="size-3.5 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  {canEditAgents && (
                                    <DropdownMenuItem onClick={() => handleEditAgent(agent)}>
                                      <Edit className="size-3.5 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  {canConfigurationSettings && (
                                    <DropdownMenuItem onClick={() => handleConfigAgent(agent)}>
                                      <Settings className="size-3.5 mr-2" />
                                      Configuration
                                    </DropdownMenuItem>
                                  )}
                                  {canAssignProducts && (
                                    <DropdownMenuItem onClick={() => handleAssignProductsAgent(agent)}>
                                      <Database className="size-3.5 mr-2" />
                                      Assign Products
                                    </DropdownMenuItem>
                                  )}
                                  {canUploadFiles && (
                                    <DropdownMenuItem onClick={() => handleUploadAgent(agent)}>
                                      <Upload className="size-3.5 mr-2" />
                                      Files
                                    </DropdownMenuItem>
                                  )}
                                  {(canViewNotifications || canCreateNotifications) && (
                                    <DropdownMenuItem onClick={() => handleNotificationsAgent(agent)}>
                                      <Bell className="size-3.5 mr-2" />
                                      Notifications
                                    </DropdownMenuItem>
                                  )}
                                  {(canViewChangelog || canCreateChangelog) && (
                                    <DropdownMenuItem onClick={() => handleChangelogAgent(agent)}>
                                      <GitCommit className="size-3.5 mr-2" />
                                      Changelog
                                    </DropdownMenuItem>
                                  )}
                                  {canManageStatus && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={() => handleStatusChange(agent.id, 'active')}>
                                        Set Active
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleStatusChange(agent.id, 'maintenance')}>
                                        Set Maintenance
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleStatusChange(agent.id, 'inactive')}>
                                        Set Inactive
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleStatusChange(agent.id, 'testing')}>
                                        Set Testing
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {canDeleteAgents && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteAgent(agent.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="size-3.5 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                        No agents found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        
        {/* Footer Stats */}
        <div className="p-3 pt-2 pb-2 border-t border-muted-foreground/20 bg-muted/10 text-xs text-muted-foreground flex-shrink-0">
          <span>{filteredAgents.length} agents</span>
        </div>
      </div>

      <AgentManagerDialogs
        showCreateDialog={showCreateDialog}
        showEditDialog={showEditDialog}
        showUploadDialog={showUploadDialog}
        showDetailsDialog={showDetailsDialog}
        showConfigDialog={showConfigDialog}
        showAssignProductsDialog={showAssignProductsDialog}
        showNotificationsDialog={showNotificationsDialog}
        showChangelogDialog={showChangelogDialog}
        selectedAgent={selectedAgent}
        canEditAgents={canEditAgents}
        canCreateAgents={canCreateAgents}
        canUploadFiles={canUploadFiles}
        canViewNotifications={canViewNotifications}
        canCreateNotifications={canCreateNotifications}
        canEditNotifications={canEditNotifications}
        canViewChangelog={canViewChangelog}
        canCreateChangelog={canCreateChangelog}
        canEditChangelog={canEditChangelog}
        canConfigurationSettings={canConfigurationSettings}
        canAssignProducts={canAssignProducts}
        setShowCreateDialog={setShowCreateDialog}
        setShowEditDialog={setShowEditDialog}
        setShowUploadDialog={setShowUploadDialog}
        setShowDetailsDialog={setShowDetailsDialog}
        setShowConfigDialog={setShowConfigDialog}
        setShowAssignProductsDialog={setShowAssignProductsDialog}
        setShowNotificationsDialog={setShowNotificationsDialog}
        setShowChangelogDialog={setShowChangelogDialog}
        setSelectedAgent={setSelectedAgent}
        closeAllDialogs={closeAllDialogs}
        onSuccess={() => {
          refetch();
          refetchStats();
        }}
        onAssignProducts={async (agentId, productIds) => {
          await assignProductsMutation(agentId, productIds);
        }}
        onUnassignProducts={async (agentId, productIds) => {
          await unassignProductsMutation(agentId, productIds);
        }}
      />
    </div>
  );
}
