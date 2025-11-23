import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createAgent } from '@/entities/agent';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await createAgent(formData);
      if (response.success) {
        toast.success('Agent created successfully!');
        setTimeout(() => {
          onSuccess();
        }, 100);
        onOpenChange(false);
        setFormData({
          name: '',
          description: '',
          status: 'active',
          version: '1.0.0'
        });
      } else {
        toast.error('Error creating agent');
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
            Fill in the information for the new agent.
          </DialogDescription>
        </DialogHeader>

        {/* Form acts as flex container filling space */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 mt-2">
          
          {/* Scrollable inputs area */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Agent name"
                required
                className="text-base sm:text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Agent description"
                required
                className="text-base sm:text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}>
                <SelectTrigger className="w-full text-base sm:text-sm">
                  <SelectValue />
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
              <Label htmlFor="version">Version *</Label>
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

          {/* Footer pinned to bottom */}
          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0 mt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.name.trim() || !formData.description.trim()}
              className="w-full sm:w-auto"
            >
              {loading ? 'Creating...' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAgentDialog;