"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
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

import { useAgentsQuery } from '@/entities/agent';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AgentDatabaseEmptyState, AgentDatabaseErrorState, AgentDatabaseAccessDenied, ViewAgentDialog } from './components';
import CreateAgentDialog from './components/CreateAgentDialog';
import EditAgentDialog from './components/EditAgentDialog';
import AssignProductsDialog from './components/AssignProductsDialog';
import AgentConfigDialog from './components/AgentConfigDialog';
import UploadAgentFilesDialog from './components/UploadAgentFilesDialog';
import { NotificationsDialog } from '@/features/notifications';
import { ChangelogManagementDialog } from '@/features/changelog';
import type { Agent } from '@/entities/agent';
import type { Product } from '@/entities/product';
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
  const { hasPermission, hasAnyPermission } = usePermissions();

  const canViewAgents = hasPermission('agents.view');
  const canCreateAgents = hasPermission('agents.create');
  const canEditAgents = hasPermission('agents.edit');
  const canDeleteAgents = hasPermission('agents.delete');
  const canUploadFiles = hasPermission('agents.upload_files');
  const canViewNotifications = hasPermission('agents.notifications_view');
  const canCreateNotifications = hasPermission('agents.notifications_create');
  const canEditNotifications = hasPermission('agents.notifications_edit');
  const canViewChangelog = hasPermission('agents.changelog_view');
  const canCreateChangelog = hasPermission('agents.changelog_create');
  const canEditChangelog = hasPermission('agents.changelog_edit');
  const canManageStatus = hasPermission('agents.status');
  const canAssignProducts = hasPermission('agents.assign_products');
  const canConfigurationSettings = hasPermission('agents.configuration_settings');

  const hasAnyAgentPermission = hasAnyPermission([
    'agents.view',
    'agents.create',
    'agents.edit',
    'agents.delete',
    'agents.upload_files',
    'agents.notifications_view',
    'agents.notifications_create',
    'agents.notifications_edit',
    'agents.changelog_view',
    'agents.changelog_create',
    'agents.changelog_edit',
    'agents.status',
    'agents.assign_products',
    'agents.configuration_settings',
  ]);

  const {
    agents,
    products,
    loading,
    error,
    updateStatus: updateStatusMutation,
    deleteAgent: deleteAgentMutation,
    assignProducts: assignProductsMutation,
    unassignProducts: unassignProductsMutation,
    refetch,
    refetchStats,
  } = useAgentsQuery();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showAssignProductsDialog, setShowAssignProductsDialog] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [showChangelogDialog, setShowChangelogDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    if (onCreateAgentRequested) {
      setShowCreateDialog(true);
      onCreateAgentRequestHandled?.();
    }
  }, [onCreateAgentRequested, onCreateAgentRequestHandled]);

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const searchMatch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (agent.description && agent.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const statusMatch = statusFilter === 'all' || agent.status === statusFilter;
      return searchMatch && statusMatch;
    });
  }, [agents, searchTerm, statusFilter]);

  const handleStatusChange = async (agentId: number, newStatus: Agent['status']) => {
    try {
      await updateStatusMutation(agentId, newStatus);
    } catch (err) {
      // Error handling
    }
  };

  const handleDeleteAgent = async (agentId: number) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      await deleteAgentMutation(agentId);
    } catch (err) {
      // Error handling
    }
  };

  const handleViewDetails = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowDetailsDialog(true);
  };

  const handleConfigAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowConfigDialog(true);
  };

  const handleAssignProductsAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowAssignProductsDialog(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowEditDialog(true);
  };

  const handleUploadAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowUploadDialog(true);
  };

  const handleNotificationsAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowNotificationsDialog(true);
  };

  const handleChangelogAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowChangelogDialog(true);
  };

  useEffect(() => {
    if (onCreateAgentRequested) {
      setShowCreateDialog(true);
      onCreateAgentRequestHandled?.();
    }
  }, [onCreateAgentRequested, onCreateAgentRequestHandled]);

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
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Agents</h2>
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
                    filteredAgents.map((agent) => {
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
                                    <DropdownMenuItem onClick={() => { setSelectedAgent(agent); setShowConfigDialog(true); }}>
                                      <Settings className="size-3.5 mr-2" />
                                      Configuration
                                    </DropdownMenuItem>
                                  )}
                                  {canAssignProducts && (
                                    <DropdownMenuItem onClick={() => { setSelectedAgent(agent); setShowAssignProductsDialog(true); }}>
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

      {/* Dialogs */}
      {canCreateAgents && (
        <CreateAgentDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={() => {
            refetch();
            refetchStats();
          }}
        />
      )}
      {canEditAgents && (
        <EditAgentDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={() => {
            refetch();
            refetchStats();
          }}
          agent={selectedAgent}
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

      <ViewAgentDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        agent={selectedAgent}
        onEdit={selectedAgent ? (agent) => {
          setShowDetailsDialog(false);
          handleEditAgent(agent);
        } : undefined}
        onUpload={selectedAgent ? handleUploadAgent : undefined}
        onNotifications={selectedAgent ? handleNotificationsAgent : undefined}
        onChangelog={selectedAgent ? handleChangelogAgent : undefined}
        onConfig={selectedAgent ? handleConfigAgent : undefined}
        onAssignProducts={selectedAgent ? handleAssignProductsAgent : undefined}
        canEdit={canEditAgents}
        canUploadFiles={canUploadFiles}
        canManageNotifications={canViewNotifications || canCreateNotifications}
        canManageChangelog={canViewChangelog || canCreateChangelog}
        canConfigure={canConfigurationSettings}
        canAssignProducts={canAssignProducts}
        onSuccess={() => {
          refetch();
          refetchStats();
        }}
      />

      {canConfigurationSettings && (
        <AgentConfigDialog
          open={showConfigDialog}
          onOpenChange={setShowConfigDialog}
          agent={selectedAgent}
          onSuccess={() => {
            refetch();
            refetchStats();
          }}
        />
      )}

      {canAssignProducts && (
        <AssignProductsDialog
          open={showAssignProductsDialog}
          onOpenChange={setShowAssignProductsDialog}
          agent={selectedAgent}
          onAssign={async (agentId, productIds) => {
            await assignProductsMutation(agentId, productIds);
          }}
          onUnassign={async (agentId, productIds) => {
            await unassignProductsMutation(agentId, productIds);
          }}
          onSuccess={() => {
            refetch();
            refetchStats();
          }}
        />
      )}

      {canUploadFiles && (
        <UploadAgentFilesDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          agent={selectedAgent}
          onSuccess={() => {
            refetch();
            refetchStats();
          }}
        />
      )}
    </div>
  );
}
