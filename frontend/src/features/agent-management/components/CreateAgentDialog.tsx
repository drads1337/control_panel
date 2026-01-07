import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createAgent } from '@/entities/agent';
import { toast } from 'sonner';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import type { CreateAgentData } from '@/entities/agent';

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateAgentDialog: React.FC<CreateAgentDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('agents.create');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateAgentData>({
    name: '',
    description: '',
    status: 'active',
    version: '1.0.0'
  });

  if (!canCreate) {
    return null;
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Agent name is required.');
      return;
    }

    try {
      setLoading(true);
      const response = await createAgent(formData);
      if (response.success) {
        toast.success('Agent created successfully!');
        onOpenChange(false);
        setFormData({
          name: '',
          description: '',
          status: 'active',
          version: '1.0.0'
        });
        onSuccess();
      } else {
        toast.error(response.message || 'Failed to create agent.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error creating agent');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setFormData({
      name: '',
      description: '',
      status: 'active',
      version: '1.0.0'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Create New Agent
            </DialogTitle>
            <DialogDescription className="text-xs">
              Fill in the details for the new agent.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="agentName" className="text-xs font-medium">Agent Name *</Label>
              <Input 
                id="agentName" 
                placeholder="Enter agent name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agentDescription" className="text-xs font-medium">Description</Label>
              <Input 
                id="agentDescription" 
                placeholder="Enter agent description (optional)"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agentStatus" className="text-xs font-medium">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="active" className="text-xs">Active</SelectItem>
                  <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
                  <SelectItem value="maintenance" className="text-xs">Maintenance</SelectItem>
                  <SelectItem value="testing" className="text-xs">Testing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agentVersion" className="text-xs font-medium">Version</Label>
              <Input 
                id="agentVersion" 
                placeholder="1.0.0" 
                value={formData.version}
                onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 mt-4">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              disabled={loading}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <ConditionalRender permission="agents.create" fallback={null}>
              <Button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
                disabled={loading || !formData.name.trim()}
                className="h-8 text-xs min-w-[80px]"
              >
                {loading ? 'Creating...' : 'Create Agent'}
              </Button>
            </ConditionalRender>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAgentDialog;

