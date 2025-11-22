import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { Spinner } from '@/components/ui/spinner';
import { usePermissions } from '@/hooks/use-permissions';
import { updateAgent } from '@/entities/agent';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Agent, UpdateAgentData } from '@/entities/agent';
interface EditAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  agent: Agent | null;
}
const EditAgentDialog: React.FC<EditAgentDialogProps> = ({ open, onOpenChange, onSuccess, agent }) => {
  const { token } = useAuth();
  const { hasPermission } = usePermissions();
  const canEditAgents = hasPermission('agents.edit');
  const canEditChangelog = hasPermission('agents.changelog_edit') || hasPermission('changelog.edit');
  const canEditNotifications = hasPermission('agents.notifications_edit') || hasPermission('notifications.edit');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdateAgentData>({
    name: '',
    description: '',
    status: 'active',
    version: '1.0.0',
    changelog: '',
    notifications: ''
  });
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        description: agent.description,
        status: agent.status,
        version: agent.version,
        changelog: agent.changelog || '',
        notifications: agent.notifications || ''
      });
    }
  }, [agent]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!token || !agent) {
      toast.error('Missing token or agent data');
      return;
    }
    
    if (!canEditAgents) {
      toast.error('You do not have permission to edit agents');
      return;
    }
    
    // Validate required fields
    if (!formData.name?.trim() || !formData.description?.trim() || !formData.version?.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      const result = await updateAgent(agent.id, formData);
      
      if (result.success) {
        toast.success('Agent updated successfully!');
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.message || 'Failed to update agent');
      }
    } catch (error) {
      console.error('Error updating agent:', error);
      toast.error(error instanceof Error ? error.message : 'Error updating agent');
    } finally {
      setLoading(false);
    }
  };
  if (!agent) return null;
  if (!canEditAgents) {
    return null;
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Agent</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Edit the information for the agent "{agent.name}".
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Agent Name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">Version *</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0.0"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detailed description of the agent"
              rows={3}
              required
            />
          </div>
          <ConditionalRender permission="agents.changelog_edit" fallback={null}>
          <div className="space-y-2">
            <Label htmlFor="changelog">Changelog</Label>
            <Textarea
              id="changelog"
              value={formData.changelog}
              onChange={(e) => setFormData(prev => ({ ...prev, changelog: e.target.value }))}
              placeholder="Description of changes in this version"
              rows={2}
              disabled={!canEditChangelog}
            />
          </div>
          </ConditionalRender>
          <ConditionalRender permission="agents.notifications_edit" fallback={null}>
          <div className="space-y-2">
            <Label htmlFor="notifications">Notifications</Label>
            <Textarea
              id="notifications"
              value={formData.notifications}
              onChange={(e) => setFormData(prev => ({ ...prev, notifications: e.target.value }))}
              placeholder="Notification text for users"
              rows={2}
              disabled={!canEditNotifications}
            />
          </div>
          </ConditionalRender>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.name?.trim() || !formData.description?.trim() || !formData.version?.trim()}
            >
              {loading ? (<><Spinner className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
export default EditAgentDialog;