import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createAgent } from '@/entities/agent';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
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
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>
            Fill in the details for the new agent.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Area */}
        <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1 scrollbar-thin">
          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Name *</Label>
            <Input 
              id="agentName" 
              placeholder="Enter agent name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="text-base sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentDescription">Description</Label>
            <Input 
              id="agentDescription" 
              placeholder="Enter agent description (optional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="text-base sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentStatus">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}
            >
              <SelectTrigger className="w-full text-base sm:text-sm">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentVersion">Version</Label>
            <Input 
              id="agentVersion" 
              placeholder="1.0.0" 
              value={formData.version}
              onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
              className="text-base sm:text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0 mt-2">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={loading}
            className="w-full sm:w-auto mt-2 sm:mt-0"
          >
            Cancel
          </Button>
          <ConditionalRender permission="agents.create" fallback={null}>
            <Button 
              onClick={handleSubmit}
              disabled={loading || !formData.name.trim()}
              className="w-full sm:w-auto"
            >
              {loading ? 'Creating...' : 'Create Agent'}
            </Button>
          </ConditionalRender>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAgentDialog;