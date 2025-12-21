import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Search, Zap, Edit, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/components/button';
import { Input } from '@/shared/ui/components/input';
import { Label } from '@/shared/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/components/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui/components/dialog';
import { useAgentsQuery } from '@/entities/agent/model/queries';
import { toast } from 'sonner';
import type { Agent, CreateAgentData, UpdateAgentData } from '@/entities/agent';

export const AgentsManager: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedAgents, setSelectedAgents] = useState<Set<number>>(new Set());
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
    
    // Form state
    const [formData, setFormData] = useState<CreateAgentData>({
        name: '',
        description: '',
        status: 'active',
        version: '1.0.0',
    });

    const {
        agents,
        loading,
        refetch,
        createAgent,
        updateAgent,
        deleteAgent,
        updateStatus,
        products,
    } = useAgentsQuery();

    const resetForm = useCallback(() => {
        setFormData({
            name: '',
            description: '',
            status: 'active',
            version: '1.0.0',
        });
    }, []);

    const openCreateDialog = useCallback(() => {
        resetForm();
        setCreateDialogOpen(true);
    }, [resetForm]);

    const openEditDialog = useCallback((agent: Agent) => {
        setEditingAgent(agent);
        setFormData({
            name: agent.name,
            description: agent.description || '',
            status: agent.status || 'active',
            version: agent.version || '1.0.0',
        });
        setEditDialogOpen(true);
    }, []);

    const openDeleteDialog = useCallback((agent: Agent) => {
        setDeletingAgent(agent);
        setDeleteDialogOpen(true);
    }, []);

    const handleCreate = useCallback(async () => {
        if (!formData.name.trim()) {
            toast.error('Agent name is required');
            return;
        }
        try {
            await createAgent(formData);
            setCreateDialogOpen(false);
            resetForm();
            refetch();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to create agent');
        }
    }, [formData, createAgent, refetch, resetForm]);

    const handleUpdate = useCallback(async () => {
        if (!editingAgent || !formData.name.trim()) {
            toast.error('Agent name is required');
            return;
        }
        try {
            await updateAgent(editingAgent.id, formData as UpdateAgentData);
            setEditDialogOpen(false);
            setEditingAgent(null);
            resetForm();
            refetch();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to update agent');
        }
    }, [editingAgent, formData, updateAgent, refetch, resetForm]);

    const handleDelete = useCallback(async () => {
        if (!deletingAgent) return;
        try {
            await deleteAgent(deletingAgent.id);
            setDeleteDialogOpen(false);
            setDeletingAgent(null);
            refetch();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to delete agent');
        }
    }, [deletingAgent, deleteAgent, refetch]);

    const handleStatusChange = useCallback(async (agent: Agent, newStatus: string) => {
        try {
            await updateStatus(
                agent.id,
                newStatus as 'active' | 'inactive' | 'maintenance' | 'testing'
            );
            refetch();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to update agent status');
        }
    }, [updateStatus, refetch]);

    const toggleAgentSelection = useCallback((agentId: number) => {
        setSelectedAgents(prev => {
            const newSet = new Set(prev);
            if (newSet.has(agentId)) {
                newSet.delete(agentId);
            } else {
                newSet.add(agentId);
            }
            return newSet;
        });
    }, []);

    // Filtered agents
    const filteredAgents = useMemo(() => {
        let filtered = agents || [];

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(a => 
                a.name.toLowerCase().includes(query) ||
                a.description?.toLowerCase().includes(query) ||
                String(a.id).includes(query)
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(a => {
                const status = a.status?.toLowerCase() || '';
                return status === statusFilter.toLowerCase();
            });
        }

        return filtered;
    }, [agents, searchQuery, statusFilter]);

    const statusDisplayMap: Record<string, string> = {
        'active': 'ACTIVE',
        'inactive': 'INACTIVE',
        'maintenance': 'MAINTENANCE',
        'testing': 'TESTING',
    };

    const getStatusColor = (status: string) => {
        const statusLower = status?.toLowerCase() || '';
        if (statusLower === 'active') {
            return 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20';
        } else if (statusLower === 'maintenance') {
            return 'bg-orange-500/5 text-orange-400 border-orange-500/20';
        } else if (statusLower === 'inactive') {
            return 'bg-gray-500/5 text-gray-400 border-gray-500/20';
        }
        return 'bg-blue-500/5 text-blue-400 border-blue-500/20';
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-text-primary-dark tracking-wide font-display">Agents</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <p className="text-[10px] text-text-secondary-dark font-mono uppercase tracking-wider">
                            {loading ? 'Loading...' : `${filteredAgents.length} configured`}
                        </p>
                    </div>
                </div>
                <Button 
                    onClick={openCreateDialog}
                    className="bg-primary hover:bg-primary-hover text-background-dark px-3 py-1.5 rounded-sm text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-glow h-auto"
                >
                    <Plus className="text-sm" />
                    NEW AGENT
                </Button>
            </div>

            {/* Filter Toolbar */}
            <div className="grid grid-cols-12 gap-2.5 mb-3 bg-surface-dark/30 p-1.5 rounded border border-border-dark/50">
                <div className="col-span-9 relative group">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none z-10">
                        <Search className="text-text-secondary-dark w-2.5 h-2.5 group-focus-within:text-primary transition-colors" />
                    </span>
                    <Input 
                        className="w-full bg-background-dark border border-border-dark rounded-sm pl-8 pr-3 py-1.5 text-[11px] text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-[10px] placeholder:text-text-secondary-dark/50 transition-all outline-none font-mono h-[28px]" 
                        placeholder="SEARCH_DB..." 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="col-span-3">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[28px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent 
                            className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                            position="popper"
                        >
                            <SelectItem value="all" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">All Status</SelectItem>
                            <SelectItem value="active" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Active</SelectItem>
                            <SelectItem value="maintenance" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Maintenance</SelectItem>
                            <SelectItem value="inactive" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Inactive</SelectItem>
                            <SelectItem value="testing" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Testing</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Agent List */}
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {loading ? (
                    <div className="flex items-center justify-center h-32 text-text-secondary-dark">
                        <p className="text-sm">Loading agents...</p>
                    </div>
                ) : filteredAgents.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-text-secondary-dark">
                        <p className="text-sm">No agents found</p>
                    </div>
                ) : (
                    filteredAgents.map((agent) => {
                        const agentId = agent.id;
                        const isSelected = selectedAgents.has(agentId);
                        
                        return (
                            <div 
                                key={agent.id} 
                                className="bg-surface-dark border border-border-dark rounded-sm p-3 flex items-center justify-between group hover:border-text-secondary-dark/30 transition-all"
                            >
                                {/* Left Section: Info */}
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    {/* Selection */}
                                    <div className="flex items-center justify-center">
                                        <div 
                                            className={`w-3.5 h-3.5 rounded-full border cursor-pointer transition-colors ${
                                                isSelected 
                                                    ? 'bg-primary border-primary' 
                                                    : 'border-border-dark hover:border-primary'
                                            }`}
                                            onClick={() => toggleAgentSelection(agentId)}
                                        />
                                    </div>
                                    
                                    {/* Icon Box */}
                                    <div className="w-9 h-9 rounded bg-background-dark border border-border-dark flex items-center justify-center text-text-secondary-dark group-hover:text-primary transition-colors shadow-sm">
                                        <Zap className="text-lg" />
                                    </div>

                                    {/* Main Details */}
                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-text-primary-dark truncate font-display">{agent.name}</span>
                                            <span className={`text-[9px] font-bold px-1 py-px rounded-[2px] border tracking-wider uppercase ${getStatusColor(agent.status)}`}>
                                                {statusDisplayMap[agent.status?.toLowerCase() || ''] || (agent.status || 'UNKNOWN').toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-text-secondary-dark font-mono leading-none mt-0.5">
                                            <span className="opacity-60">VER <span className="text-text-primary-dark opacity-100">{agent.version || '1.0.0'}</span></span>
                                            <span className="w-px h-2 bg-border-dark"></span>
                                            <span className="opacity-60">ID: <span className="text-text-primary-dark opacity-100">{agent.id}</span></span>
                                            <span className="w-px h-2 bg-border-dark"></span>
                                            <span className="px-1.5 py-px rounded bg-white/5 border border-border-dark text-[9px] opacity-70">
                                                {agent.assigned_products?.length || 0} PRODUCTS
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Section: Stats & Actions */}
                                <div className="flex items-center gap-6">
                                    {/* Stats */}
                                    <div className="hidden xl:flex items-center gap-4 text-[10px] font-mono text-text-secondary-dark border-r border-border-dark pr-6 mr-2">
                                        <div className="flex flex-col items-end leading-tight">
                                            <span className="text-text-primary-dark font-bold">{agent.downloads || 0}</span>
                                            <span className="text-[9px] opacity-50 uppercase">Downloads</span>
                                        </div>
                                        <div className="flex flex-col items-end leading-tight">
                                            <span className="text-text-primary-dark font-bold">{agent.active_users || 0}</span>
                                            <span className="text-[9px] opacity-50 uppercase">Users</span>
                                        </div>
                                    </div>

                                    {/* Controls */}
                                    <div className="flex items-center gap-2">
                                        <Select 
                                            value={agent.status?.toLowerCase() || 'active'}
                                            onValueChange={(value) => handleStatusChange(agent, value)}
                                        >
                                            <SelectTrigger className="w-32 min-w-[128px] bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent 
                                                className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm min-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)] !z-[100]"
                                                position="popper"
                                            >
                                                <SelectItem value="active" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Active</SelectItem>
                                                <SelectItem value="maintenance" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Maintenance</SelectItem>
                                                <SelectItem value="inactive" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Inactive</SelectItem>
                                                <SelectItem value="testing" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Testing</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditDialog(agent)}
                                            className="w-6 h-6 rounded-sm hover:bg-white/5 text-text-secondary-dark hover:text-text-primary-dark border border-transparent hover:border-border-dark"
                                        >
                                            <Edit className="text-xs" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openDeleteDialog(agent)}
                                            className="w-6 h-6 rounded-sm hover:bg-white/5 text-text-secondary-dark hover:text-text-primary-dark border border-transparent hover:border-border-dark"
                                        >
                                            <MoreHorizontal className="text-sm" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer Pagination */}
            <div className="flex items-center justify-between pt-3 border-t border-border-dark mt-auto">
                <span className="text-[9px] font-mono text-text-secondary-dark uppercase tracking-widest opacity-50">
                    {filteredAgents.length > 0 
                        ? `Showing ${filteredAgents.length} of ${agents.length} agents`
                        : 'No agents'
                    }
                </span>
                <div className="flex gap-1">
                    <Button 
                        variant="outline"
                        size="icon"
                        className="w-6 h-6 rounded-sm border border-border-dark bg-background-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 disabled:opacity-30"
                    >
                        <ChevronLeft className="text-xs" />
                    </Button>
                    <Button 
                        variant="outline"
                        size="icon"
                        className="w-6 h-6 rounded-sm border border-border-dark bg-background-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 disabled:opacity-30"
                    >
                        <ChevronRight className="text-xs" />
                    </Button>
                </div>
            </div>

            {/* Create Agent Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-text-primary-dark">Create New Agent</DialogTitle>
                        <DialogDescription className="text-text-secondary-dark">
                            Fill in the details to create a new agent
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-text-secondary-dark">Agent Name *</Label>
                            <Input
                                id="name"
                                className="bg-background-dark border-border-dark text-text-primary-dark"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter agent name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-text-secondary-dark">Description</Label>
                            <Input
                                id="description"
                                className="bg-background-dark border-border-dark text-text-primary-dark"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Enter agent description"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="version" className="text-text-secondary-dark">Version</Label>
                                <Input
                                    id="version"
                                    className="bg-background-dark border-border-dark text-text-primary-dark"
                                    value={formData.version}
                                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                    placeholder="1.0.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status" className="text-text-secondary-dark">Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent 
                                        className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                                        position="popper"
                                    >
                                        <SelectItem value="active" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Active</SelectItem>
                                        <SelectItem value="inactive" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Inactive</SelectItem>
                                        <SelectItem value="maintenance" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Maintenance</SelectItem>
                                        <SelectItem value="testing" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Testing</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCreateDialogOpen(false)}
                            className="bg-background-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={!formData.name.trim()}
                            className="bg-primary hover:bg-primary-hover text-background-dark"
                        >
                            Create Agent
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Agent Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-text-primary-dark">Edit Agent</DialogTitle>
                        <DialogDescription className="text-text-secondary-dark">
                            Update agent details
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-text-secondary-dark">Agent Name *</Label>
                            <Input
                                id="edit-name"
                                className="bg-background-dark border-border-dark text-text-primary-dark"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter agent name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-description" className="text-text-secondary-dark">Description</Label>
                            <Input
                                id="edit-description"
                                className="bg-background-dark border-border-dark text-text-primary-dark"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Enter agent description"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-version" className="text-text-secondary-dark">Version</Label>
                                <Input
                                    id="edit-version"
                                    className="bg-background-dark border-border-dark text-text-primary-dark"
                                    value={formData.version}
                                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                    placeholder="1.0.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-status" className="text-text-secondary-dark">Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent 
                                        className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                                        position="popper"
                                    >
                                        <SelectItem value="active" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Active</SelectItem>
                                        <SelectItem value="inactive" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Inactive</SelectItem>
                                        <SelectItem value="maintenance" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Maintenance</SelectItem>
                                        <SelectItem value="testing" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Testing</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditDialogOpen(false)}
                            className="bg-background-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            disabled={!formData.name.trim()}
                            className="bg-primary hover:bg-primary-hover text-background-dark"
                        >
                            Update Agent
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Agent Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-text-primary-dark">Delete Agent</DialogTitle>
                        <DialogDescription className="text-text-secondary-dark">
                            Are you sure you want to delete <strong>{deletingAgent?.name}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            className="bg-background-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

