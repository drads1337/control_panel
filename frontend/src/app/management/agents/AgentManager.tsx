import React, { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search, Check, X, Container, MoreVertical, Edit, Trash2, Upload, Bell, Eye, Settings, Database, GitCommit } from 'lucide-react';
import { useAgentsQuery } from '@/entities/agent';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AgentsTable } from './AgentsTable';
import { AgentDatabaseEmptyState } from './AgentDatabaseEmptyState';
import { AgentDatabaseErrorState } from './AgentDatabaseErrorState';
import { AgentDatabaseAccessDenied } from './AgentDatabaseAccessDenied';
import { AgentDatabaseDialogs } from './AgentDatabaseDialogs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { sanitizeString } from '@/lib/sanitization';
import type { Agent } from '@/entities/agent';
import { cn } from '@/lib/utils';

// Хук для определения размера экрана
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

interface AgentManagerProps {
  onCreateAgentRequested?: boolean;
  onCreateAgentRequestHandled?: () => void;
}

const AgentManager: React.FC<AgentManagerProps> = ({ 
  onCreateAgentRequested,
  onCreateAgentRequestHandled,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
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

  // Check if user has any permission related to agents
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
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  
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

  const toggleAgentSelection = (agentId: number) => {
    setSelectedAgents(prev => prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]);
  };

  const clearSelection = () => setSelectedAgents([]);

  const allSelected = selectedAgents.length === filteredAgents.length && filteredAgents.length > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedAgents(filteredAgents.map((a) => a.id));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedAgents.length === 0) return;

    try {
      const actions = selectedAgents.map(agentId => {
        switch (bulkAction) {
          case 'activate': return updateStatusMutation(agentId, 'active');
          case 'deactivate': return updateStatusMutation(agentId, 'inactive');
          case 'maintenance': return updateStatusMutation(agentId, 'maintenance');
          case 'testing': return updateStatusMutation(agentId, 'testing');
          case 'delete': return deleteAgentMutation(agentId);
          default: return Promise.resolve();
        }
      });
      await Promise.all(actions);
      clearSelection();
      setBulkAction('');
    } catch (err) {
      // Error handling
    }
  };

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

  const handleEditAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowEditDialog(true);
  };

  const handleUploadFiles = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowUploadDialog(true);
  };

  const handleConfigAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowConfigDialog(true);
  };

  const handleAssignProducts = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowAssignProductsDialog(true);
  };

  const handleNotificationsProduct = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowNotificationsDialog(true);
  };

  const handleChangelogProduct = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowChangelogDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'maintenance': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'testing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Компонент карточки для мобильного вида
  const MobileAgentCard = ({ agent }: { agent: Agent }) => {
    const isSelected = selectedAgents.includes(agent.id);
    
    return (
      <div className={cn(
        "flex flex-col p-4 border rounded-lg bg-card text-card-foreground shadow-sm transition-colors",
        isSelected ? "border-primary/50 bg-primary/5" : "border-border"
      )}>
        <div className="flex justify-between items-start mb-3 border-b pb-3">
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={isSelected}
              onCheckedChange={() => toggleAgentSelection(agent.id)}
            />
            <div>
              <h4 className="font-semibold text-sm truncate max-w-[180px]">{sanitizeString(agent.name)}</h4>
              <Badge variant="secondary" className={cn("mt-1 text-xs capitalize", getStatusColor(agent.status))}>
                {agent.status}
              </Badge>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleViewDetails(agent)}>
                <Eye className="mr-2 h-4 w-4" /> View Details
              </DropdownMenuItem>
              {canEditAgents && (
                <DropdownMenuItem onClick={() => handleEditAgent(agent)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {canConfigurationSettings && (
                <DropdownMenuItem onClick={() => handleConfigAgent(agent)}>
                  <Settings className="mr-2 h-4 w-4" /> Configuration
                </DropdownMenuItem>
              )}
              {canAssignProducts && (
                <DropdownMenuItem onClick={() => handleAssignProducts(agent)}>
                  <Database className="mr-2 h-4 w-4" /> Assign Products
                </DropdownMenuItem>
              )}
              {canUploadFiles && (
                <DropdownMenuItem onClick={() => handleUploadFiles(agent)}>
                  <Upload className="mr-2 h-4 w-4" /> Files
                </DropdownMenuItem>
              )}
              {(canViewNotifications || canCreateNotifications) && (
                <DropdownMenuItem onClick={() => handleNotificationsProduct(agent)}>
                  <Bell className="mr-2 h-4 w-4" /> Notifications
                </DropdownMenuItem>
              )}
              {(canViewChangelog || canCreateChangelog) && (
                <DropdownMenuItem onClick={() => handleChangelogProduct(agent)}>
                  <GitCommit className="mr-2 h-4 w-4" /> Changelog
                </DropdownMenuItem>
              )}
              {canManageStatus && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
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
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
           <div>
             <span className="font-medium text-foreground">Version:</span> {agent.version || 'N/A'}
           </div>
           {agent.created_at && (
             <div className="text-right">
               {new Date(agent.created_at).toLocaleDateString()}
             </div>
           )}
        </div>
        <div className="mt-2 pt-2 border-t text-xs">
          <span className="font-medium text-foreground">ID:</span> <span className="font-sans opacity-70">{agent.id}</span>
        </div>
      </div>
    );
  };

  if (!hasAnyAgentPermission) {
    return <AgentDatabaseAccessDenied />;
  }

  if (error) {
    return <AgentDatabaseErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className={cn("space-y-4", isMobile && "pb-6")}>
      {!loading && filteredAgents.length === 0 && agents.length === 0 ? (
        <AgentDatabaseEmptyState 
          onCreateAgent={() => setShowCreateDialog(true)}
          canCreateAgents={canCreateAgents}
        />
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <div>
                  <CardTitle className="text-base">Agents</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {filteredAgents.length} {filteredAgents.length === 1 ? 'agent' : 'agents'}
                  </CardDescription>
                </div>
                {/* Mobile Refresh/Add buttons moved to top right next to title */}
                <div className="flex sm:hidden items-center gap-2">
                   <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={refetch}
                      disabled={loading}
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <ConditionalRender permission="agents.create" fallback={null}>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => setShowCreateDialog(true)}
                        disabled={loading}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </ConditionalRender>
                </div>
              </div>
              
              <div className="hidden sm:flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={refetch}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <ConditionalRender permission="agents.create" fallback={null}>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => setShowCreateDialog(true)}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </ConditionalRender>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-full"
                />
              </div>
              <Select 
                value={statusFilter} 
                onValueChange={(value: 'all' | 'active' | 'inactive' | 'maintenance' | 'testing') =>
                  setStatusFilter(value)
                }
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedAgents.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-4 border-t gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Selected: {selectedAgents.length}
                  </span>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <ConditionalRender 
                    permissions={['agents.status', 'agents.delete']}
                    requireAll={false}
                    fallback={null}
                  >
                    <Select value={bulkAction} onValueChange={setBulkAction}>
                      <SelectTrigger className="flex-1 sm:w-40">
                        <SelectValue placeholder="Action" />
                      </SelectTrigger>
                      <SelectContent>
                        <ConditionalRender permission="agents.status" fallback={null}>
                          <SelectItem value="activate">Activate</SelectItem>
                          <SelectItem value="deactivate">Deactivate</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="testing">Testing</SelectItem>
                        </ConditionalRender>
                        <ConditionalRender permission="agents.delete" fallback={null}>
                          <SelectItem value="delete">Delete</SelectItem>
                        </ConditionalRender>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleBulkAction} 
                      disabled={!bulkAction || (!canManageStatus && !canDeleteAgents)} 
                      size="sm"
                    >
                      Apply
                    </Button>
                  </ConditionalRender>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className={cn("pt-0", !isMobile && "-mt-3", isMobile && "pb-8")}>
            {loading ? (
              <Spinner message="Loading agents..." />
            ) : filteredAgents.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Container className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <div className="text-sm text-muted-foreground">No agents found</div>
                </div>
              </div>
            ) : (
              <>
                <div className={cn("flex items-center gap-2 mb-2 pb-2 border-b", isMobile && "mt-2")}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={filteredAgents.length === 0}
                    className={cn(isMobile && "w-full")}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select All
                  </Button>
                </div>
                
                {/* Desktop View: Table */}
                {!isMobile && (
                  <AgentsTable
                    agents={filteredAgents}
                    selectedAgents={selectedAgents}
                    onToggleAgentSelection={toggleAgentSelection}
                    onViewDetails={handleViewDetails}
                    onEditAgent={handleEditAgent}
                    onConfigAgent={handleConfigAgent}
                    onAssignProducts={handleAssignProducts}
                    onUploadFiles={handleUploadFiles}
                    onNotificationsProduct={handleNotificationsProduct}
                    onChangelogProduct={handleChangelogProduct}
                    onStatusChange={handleStatusChange}
                    onDeleteAgent={handleDeleteAgent}
                    canEditAgents={canEditAgents}
                    canDeleteAgents={canDeleteAgents}
                    canUploadFiles={canUploadFiles}
                    canViewNotifications={canViewNotifications}
                    canCreateNotifications={canCreateNotifications}
                    canEditNotifications={canEditNotifications}
                    canViewChangelog={canViewChangelog}
                    canCreateChangelog={canCreateChangelog}
                    canEditChangelog={canEditChangelog}
                    canManageStatus={canManageStatus}
                    canAssignProducts={canAssignProducts}
                    canConfigurationSettings={canConfigurationSettings}
                  />
                )}

                {/* Mobile View: Cards */}
                {isMobile && (
                  <div className="mt-2 space-y-3 mb-4">
                    {filteredAgents.map(agent => (
                      <MobileAgentCard key={agent.id} agent={agent} />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <AgentDatabaseDialogs
        showCreateDialog={showCreateDialog}
        showEditDialog={showEditDialog}
        showUploadDialog={showUploadDialog}
        showDetailsDialog={showDetailsDialog}
        showConfigDialog={showConfigDialog}
        showAssignProductsDialog={showAssignProductsDialog}
        showNotificationsDialog={showNotificationsDialog}
        showChangelogDialog={showChangelogDialog}
        selectedAgent={selectedAgent}
        products={products}
        canCreateAgents={canCreateAgents}
        canEditAgents={canEditAgents}
        canUploadFiles={canUploadFiles}
        canConfigurationSettings={canConfigurationSettings}
        canAssignProducts={canAssignProducts}
        canViewNotifications={canViewNotifications}
        canCreateNotifications={canCreateNotifications}
        canViewChangelog={canViewChangelog}
        canCreateChangelog={canCreateChangelog}
        setShowCreateDialog={setShowCreateDialog}
        setShowEditDialog={setShowEditDialog}
        setShowUploadDialog={setShowUploadDialog}
        setShowDetailsDialog={setShowDetailsDialog}
        setShowConfigDialog={setShowConfigDialog}
        setShowAssignProductsDialog={setShowAssignProductsDialog}
        setShowNotificationsDialog={setShowNotificationsDialog}
        setShowChangelogDialog={setShowChangelogDialog}
        onSuccess={() => {
          refetch();
          refetchStats();
        }}
        onAssignProducts={async (agentId, productIds) => {
          try {
            await assignProductsMutation(agentId, productIds);
          } catch (error) {
            // Error handling
          }
        }}
        onUnassignProducts={async (agentId, productIds) => {
          try {
            await unassignProductsMutation(agentId, productIds);
          } catch (error) {
            // Error handling
          }
        }}
      />
    </div>
  );
};

export default AgentManager;
