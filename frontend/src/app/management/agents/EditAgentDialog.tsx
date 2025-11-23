import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    
    if (!token || !agent) {
      toast.error('Missing token or agent data');
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
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle className="text-base">Edit Agent</DialogTitle>
          <DialogDescription className="mt-1 text-xs truncate pr-4">
            Edit the information for the agent "{agent.name}".
          </DialogDescription>
        </DialogHeader>

        {/* Form container acts as flex parent */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 mt-2">
          
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Agent Name"
                  required
                  className="text-base sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version" className="text-sm font-medium">Version *</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0.0"
                  required
                  className="text-base sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description of the agent"
                rows={3}
                required
                className="text-base sm:text-sm resize-none"
              />
            </div>
          </div>

          {/* Footer pinned to bottom */}
          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0 mt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.name?.trim() || !formData.description?.trim() || !formData.version?.trim()}
              className="w-full sm:w-auto"
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