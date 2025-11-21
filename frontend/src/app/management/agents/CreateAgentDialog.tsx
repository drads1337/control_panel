import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createAgent } from '@/entities/agent';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { Download, FileText, Tag, Activity, Plus } from 'lucide-react';
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>
            Fill in the information for the new agent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Agent name"
              required
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
            />
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
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.name.trim() || !formData.description.trim()}
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