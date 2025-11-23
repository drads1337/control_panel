import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Zap, Plus, Edit, Trash2, AlertTriangle, Upload, Bell, Eye, 
  Settings, Database, GitCommit, Search, RefreshCw, Check, X, Container,
  MoreVertical, Download, Users, Layers, Activity
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { recordAgentDownload } from '@/entities/agent';
import { useAgentsQuery } from '@/entities/agent';
import CreateAgentDialog from './CreateAgentDialog';
import EditAgentDialog from './EditAgentDialog';
import UploadAgentFilesDialog from './UploadAgentFilesDialog';
import AgentDetailsDialog from './AgentDetailsDialog';
import AgentConfigDialog from './AgentConfigDialog';
import AssignProductsDialog from './AssignProductsDialog';
import CreateProductDialog from '../products/CreateProductDialog';
import NotificationsDialog from '../notifications/NotificationsDialog';
import ChangelogManagementDialog from '../changelog/ChangelogManagementDialog';
import { toast } from 'sonner';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { Spinner } from '@/components/ui/spinner';
import { sanitizeString } from '@/lib/sanitization';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Agent } from '@/entities/agent';
import type { Product } from '@/entities/product';

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

interface AgentsListProps {
  agents: Agent[];
  products: Product[];
  selectedAgents: number[];
  onToggleAgentSelection: (agentId: number) => void;
  onViewDetails: (agent: Agent) => void;
  onEditAgent: (agent: Agent) => void;
  onConfigAgent: (agent: Agent) => void;
  onAssignProducts: (agent: Agent) => void;
  onUploadFiles: (agent: Agent) => void;
  onNotificationsProduct: (agent: Agent) => void;
  onChangelogProduct: (agent: Agent) => void;
  onStatusChange: (agentId: number, newStatus: Agent['status']) => void;
  onDeleteAgent: (agentId: number) => void;
  canEditAgents: boolean;
  canDeleteAgents: boolean;
  canUploadFiles: boolean;
  canViewNotifications: boolean;
  canCreateNotifications: boolean;
  canEditNotifications: boolean;
  canViewChangelog: boolean;
  canCreateChangelog: boolean;
  canEditChangelog: boolean;
  canManageStatus: boolean;
  canAssignProducts: boolean;
  canConfigurationSettings: boolean;
}

const AgentsList: React.FC<AgentsListProps> = ({
  agents,
  products,
  selectedAgents,
  onToggleAgentSelection,
  onViewDetails,
  onEditAgent,
  onConfigAgent,
  onAssignProducts,
  onUploadFiles,
  onNotificationsProduct,
  onChangelogProduct,
  onStatusChange,
  onDeleteAgent,
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
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = agents.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? agents.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180, // Increased estimate size to accommodate mobile cards
    overscan: 5,
    enabled: shouldVirtualize,
  });

  const getStatusBadge = (status: string) => {
    const statusType = status as StatusType;
    return (
      <span className={cn(getStatusClasses(statusType), "whitespace-nowrap")}>
        {getStatusText(statusType)}
      </span>
    );
  };

  const renderAgentItem = (agent: Agent) => {
    if (isMobile) {
      // Mobile Card View - matching ProductDatabase style
      return (
        <div className={cn(
          "flex flex-col p-4 border rounded-lg bg-card text-card-foreground shadow-sm mb-3 transition-colors",
          selectedAgents.includes(agent.id) ? "border-primary/50 bg-primary/5" : "border-border"
        )}>
          <div className="flex justify-between items-start mb-3 border-b pb-3">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedAgents.includes(agent.id)}
                onCheckedChange={() => onToggleAgentSelection(agent.id)}
              />
              <div>
                <h4 className="font-semibold text-sm truncate max-w-[180px]">{sanitizeString(agent.name)}</h4>
                <Badge variant="secondary" className={cn("mt-1 text-xs capitalize", getStatusClasses(agent.status as StatusType))}>
                  {getStatusText(agent.status as StatusType)}
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
                <DropdownMenuItem onClick={() => onViewDetails(agent)}>
                  <Eye className="mr-2 h-4 w-4" /> View Details
                </DropdownMenuItem>
                {canEditAgents && (
                  <DropdownMenuItem onClick={() => onEditAgent(agent)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {canConfigurationSettings && (
                  <DropdownMenuItem onClick={() => onConfigAgent(agent)}>
                    <Settings className="mr-2 h-4 w-4" /> Configuration
                  </DropdownMenuItem>
                )}
                {canAssignProducts && (
                  <DropdownMenuItem onClick={() => onAssignProducts(agent)}>
                    <Database className="mr-2 h-4 w-4" /> Assign Products
                  </DropdownMenuItem>
                )}
                {canUploadFiles && (
                  <DropdownMenuItem onClick={() => onUploadFiles(agent)}>
                    <Upload className="mr-2 h-4 w-4" /> Files
                  </DropdownMenuItem>
                )}
                {(canViewNotifications || canCreateNotifications) && (
                  <DropdownMenuItem onClick={() => onNotificationsProduct(agent)}>
                    <Bell className="mr-2 h-4 w-4" /> Notifications
                  </DropdownMenuItem>
                )}
                {(canViewChangelog || canCreateChangelog) && (
                  <DropdownMenuItem onClick={() => onChangelogProduct(agent)}>
                    <GitCommit className="mr-2 h-4 w-4" /> Changelog
                  </DropdownMenuItem>
                )}
                {canManageStatus && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Status</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onStatusChange(agent.id, 'active')}>
                      Set Active
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(agent.id, 'maintenance')}>
                      Set Maintenance
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(agent.id, 'inactive')}>
                      Set Inactive
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(agent.id, 'testing')}>
                      Set Testing
                    </DropdownMenuItem>
                  </>
                )}
                {canDeleteAgents && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDeleteAgent(agent.id)}
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
        </div>
      );
    } else {
      // Desktop Row View
      const assignedIds = agent.assigned_products || [];
      const assignedProductsNames = assignedIds
        .map((productId: number) => products.find(p => p.id === productId)?.name)
        .filter(Boolean)
        .join(', ');

      return (
        <div className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Checkbox
              checked={selectedAgents.includes(agent.id)}
              onCheckedChange={() => onToggleAgentSelection(agent.id)}
            />
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              {agent.logo ? (
                <img src={agent.logo} alt={agent.name} className="w-7 h-7 rounded" />
              ) : (
                <Container className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h4 className="font-medium text-sm truncate">{sanitizeString(agent.name)}</h4>
                {selectedAgents.includes(agent.id) && (
                  <Check className="h-3 w-3 text-primary" />
                )}
                {getStatusBadge(agent.status)}
              </div>
              {agent.description && (
                <p className="text-xs text-muted-foreground truncate mb-1">
                  {sanitizeString(agent.description)}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <span className="font-mono">ID: {agent.id}</span>
                <span>•</span>
                <span>v{agent.version}</span>
                <span>•</span>
                <span>{agent.downloads.toLocaleString()} downloads</span>
                <span>•</span>
                <span>{agent.active_users.toLocaleString()} users</span>
                {(agent.assigned_products?.length || 0) > 0 && (
                  <>
                    <span>•</span>
                    <span>{agent.assigned_products?.length || 0} products</span>
                  </>
                )}
                {assignedProductsNames && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-xs" title={assignedProductsNames}>
                      {assignedProductsNames}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onViewDetails(agent)}
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {canEditAgents && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEditAgent(agent)}
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canConfigurationSettings && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onConfigAgent(agent)}
                title="Configuration"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {canAssignProducts && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onAssignProducts(agent)}
                title="Assign Products"
              >
                <Database className="h-4 w-4" />
              </Button>
            )}
            {canUploadFiles && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onUploadFiles(agent)}
                title="Upload Files"
              >
                <Upload className="h-4 w-4" />
              </Button>
            )}
            {(canViewNotifications || canCreateNotifications || canEditNotifications) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onNotificationsProduct(agent)}
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
              </Button>
            )}
            {(canViewChangelog || canCreateChangelog || canEditChangelog) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onChangelogProduct(agent)}
                title="Changelog"
              >
                <GitCommit className="h-4 w-4" />
              </Button>
            )}
            {canManageStatus && (
              <Select
                value={agent.status}
                onValueChange={(value) => onStatusChange(agent.id, value as Agent['status'])}
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                </SelectContent>
              </Select>
            )}
            {canDeleteAgents && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDeleteAgent(agent.id)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      );
    }
  };

  if (shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px', contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <div className={isMobile ? "space-y-3" : "divide-y"}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const agent = agents[virtualRow.index];
              return (
                <div
                  key={agent.id}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderAgentItem(agent)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isMobile ? "space-y-3" : "divide-y"}>
      {agents.map((agent) => (
        <div key={agent.id}>
          {renderAgentItem(agent)}
        </div>
      ))}
    </div>
  );
};

interface AgentManagerProps {
  onCreateAgentRequested?: boolean;
  onCreateAgentRequestHandled?: () => void;
}

const AgentManager: React.FC<AgentManagerProps> = ({ onCreateAgentRequested, onCreateAgentRequestHandled }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();

  const canViewAgents = hasPermission('agents.view');
  const canCreateAgents = hasPermission('agents.create');
  const canEditAgents = hasPermission('agents.edit');
  const canDeleteAgents = hasPermission('agents.delete');
  const canUploadFiles = hasPermission('agents.upload_files');
  const canViewNotifications = hasPermission('agents.notifications_view');
  const canCreateNotifications = hasPermission('agents.notifications_create');
  const canEditNotifications = hasPermission('agents.notifications_edit');
  const canDeleteNotifications = hasPermission('agents.notifications_delete');
  const canViewChangelog = hasPermission('agents.changelog_view');
  const canCreateChangelog = hasPermission('agents.changelog_create');
  const canEditChangelog = hasPermission('agents.changelog_edit');
  const canDeleteChangelog = hasPermission('agents.changelog_delete');
  const canManageStatus = hasPermission('agents.status');
  const canAssignProducts = hasPermission('agents.assign_products');
  const canConfigurationSettings = hasPermission('agents.configuration_settings');

  const {
    agents,
    products,
    loading,
    error,
    stats,
    statsLoading,
    createAgent: createAgentMutation,
    updateAgent: updateAgentMutation,
    deleteAgent: deleteAgentMutation,
    updateStatus: updateStatusMutation,
    assignProducts: assignProductsMutation,
    unassignProducts: unassignProductsMutation,
    refetch,
    refetchStats,
  } = useAgentsQuery();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [uploadFilesDialogOpen, setUploadFilesDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [assignProductsDialogOpen, setAssignProductsDialogOpen] = useState(false);
  const [createProductDialogOpen, setCreateProductDialogOpen] = useState(false);
  const [notificationsDialogOpen, setNotificationsDialogOpen] = useState(false);
  const [changelogDialogOpen, setChangelogDialogOpen] = useState(false);

  if (!canViewAgents) {
    return (
      <Card className="text-center p-8">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-muted-foreground">You don't have permission to view agents.</p>
      </Card>
    );
  }

  React.useEffect(() => {
    if (onCreateAgentRequested) {
      setCreateDialogOpen(true);
      onCreateAgentRequestHandled?.();
    }
  }, [onCreateAgentRequested, onCreateAgentRequestHandled]);

  const toggleAgentSelection = (agentId: number) => {
    setSelectedAgents(prev => prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]);
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
      setSelectedAgents([]);
      setBulkAction('');
    } catch (err) {}
  };

  const handleStatusChange = async (agentId: number, newStatus: Agent['status']) => {
    try { await updateStatusMutation(agentId, newStatus); } catch (err) {}
  };

  const handleDeleteAgent = async (agentId: number) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try { await deleteAgentMutation(agentId); } catch (err) {}
  };

  const handleEditAgent = (agent: Agent) => { setSelectedAgent(agent); setEditDialogOpen(true); };
  const handleUploadFiles = (agent: Agent) => { setSelectedAgent(agent); setUploadFilesDialogOpen(true); };
  const handleViewDetails = (agent: Agent) => { setSelectedAgent(agent); setDetailsDialogOpen(true); };
  const handleConfigAgent = (agent: Agent) => { setSelectedAgent(agent); setConfigDialogOpen(true); };
  const handleAssignProducts = (agent: Agent) => { setSelectedAgent(agent); setAssignProductsDialogOpen(true); };
  const handleNotificationsProduct = (agent: Agent) => { setSelectedAgent(agent); setNotificationsDialogOpen(true); };
  const handleChangelogProduct = (agent: Agent) => { setSelectedAgent(agent); setChangelogDialogOpen(true); };

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const searchMatch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (agent.description && agent.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const statusMatch = statusFilter === 'all' || agent.status === statusFilter;
      return searchMatch && statusMatch;
    });
  }, [agents, searchTerm, statusFilter]);

  const allSelected = selectedAgents.length === filteredAgents.length && filteredAgents.length > 0;

  const handleSelectAll = () => {
    if (allSelected) { setSelectedAgents([]); } else { setSelectedAgents(filteredAgents.map(a => a.id)); }
  };

  const clearSelection = () => setSelectedAgents([]);

  if (error) {
    return (
      <Card className="text-center p-8">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-semibold mb-2">Error Loading Agents</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!loading && filteredAgents.length === 0 && agents.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Container className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">No Agents Yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                Get started by creating your first agent. You can manage settings, upload files, and track usage.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <ConditionalRender permission="products.create" fallback={null}>
                  <Button 
                    onClick={() => setCreateProductDialogOpen(true)}
                    variant="outline"
                    className="gap-2 w-full sm:w-auto"
                    size="lg"
                  >
                    <Plus className="h-5 w-5" />
                    Create Products
                  </Button>
                </ConditionalRender>
                {canCreateAgents && (
                  <Button 
                    onClick={() => setCreateDialogOpen(true)}
                    className="gap-2 w-full sm:w-auto"
                    size="lg"
                  >
                    <Plus className="h-5 w-5" />
                    Create First Agent
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
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
                      onClick={() => setCreateDialogOpen(true)}
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
                    onClick={() => setCreateDialogOpen(true)}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </ConditionalRender>
              </div>
            </div>
            
            {/* Responsive Filters */}
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
                onValueChange={setStatusFilter}
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
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
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
                    <div className="flex gap-2 w-full sm:w-auto">
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
                    </div>
                  </ConditionalRender>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className={cn("pt-0", !isMobile && "-mt-3")}>
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
                <AgentsList
                  agents={filteredAgents}
                  products={products}
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
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs ... */}
      {canCreateAgents && (
        <CreateAgentDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            refetch();
            refetchStats();
          }}
        />
      )}
      {canEditAgents && (
        <EditAgentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => { refetch(); refetchStats(); }}
          agent={selectedAgent}
        />
      )}
      {canUploadFiles && (
        <UploadAgentFilesDialog
          open={uploadFilesDialogOpen}
          onOpenChange={setUploadFilesDialogOpen}
          onSuccess={() => { refetch(); refetchStats(); }}
          agent={selectedAgent}
        />
      )}
      <AgentDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        agent={selectedAgent}
        products={products}
      />
      {canConfigurationSettings && (
        <AgentConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          onSuccess={() => { refetch(); refetchStats(); }}
          agent={selectedAgent}
        />
      )}
      {canAssignProducts && (
        <AssignProductsDialog
        open={assignProductsDialogOpen}
        onOpenChange={setAssignProductsDialogOpen}
        agent={selectedAgent}
        onAssign={async (agentId, productIds) => {
          try { await assignProductsMutation(agentId, productIds); } catch (error) {}
        }}
        onUnassign={async (agentId, productIds) => {
          try { await unassignProductsMutation(agentId, productIds); } catch (error) {}
        }}
        />
      )}
      <CreateProductDialog
        open={createProductDialogOpen}
        onOpenChange={setCreateProductDialogOpen}
        onSuccess={() => { refetch(); refetchStats(); }}
      />
      {(canViewNotifications || canCreateNotifications) && selectedAgent && (
        <NotificationsDialog
          key="agent-notifications-dialog"
          open={notificationsDialogOpen}
          onOpenChange={setNotificationsDialogOpen}
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
          open={changelogDialogOpen}
          onOpenChange={setChangelogDialogOpen}
          product={{
            id: selectedAgent.id,
            name: selectedAgent.name,
            is_multi_app: false,
          } as Product}
          isAgent={true}
        />
      )}
    </div>
  );
};

export default AgentManager;