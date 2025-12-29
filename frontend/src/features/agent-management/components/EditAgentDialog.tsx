import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateAgent } from '@/entities/agent';
import { toast } from 'sonner';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import type { Agent, UpdateAgentData } from '@/entities/agent';

interface EditAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  agent: Agent | null;
}

const EditAgentDialog: React.FC<EditAgentDialogProps> = ({ open, onOpenChange, onSuccess, agent }) => {
  const { hasPermission } = usePermissions();
  const canEditAgents = hasPermission('agents.edit');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdateAgentData>({
    name: '',
    description: '',
    version: '1.0.0'
  });

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        description: agent.description,
        version: agent.version
      });
    }
  }, [agent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!agent) {
      toast.error('Missing agent data');
      return;
    }
    
    if (!canEditAgents) {
      toast.error('You do not have permission to edit agents');
      return;
    }
    
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
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Edit Agent
            </DialogTitle>
            <DialogDescription className="text-xs">
              {agent.name}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium">Agent Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Agent name"
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="version" className="text-xs font-medium">Version</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0.0"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description of the agent"
                rows={3}
                className="text-xs resize-none min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 mt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <ConditionalRender permission="agents.edit" fallback={null}>
                <Button 
                  type="button"
                  disabled={loading}
                  className="h-8 text-xs min-w-[80px]"
                  onClick={async (e) => {
                    e.preventDefault();
                    await handleSubmit(e as any);
                  }}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </ConditionalRender>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditAgentDialog;

