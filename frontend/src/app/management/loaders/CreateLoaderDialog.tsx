import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createLoader } from '@/entities/loader';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { Download, FileText, Tag, Activity, Plus } from 'lucide-react';
import type { CreateLoaderData, Loader } from '@/entities/loader';

interface CreateLoaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateLoaderDialog: React.FC<CreateLoaderDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('loaders.create');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateLoaderData>({
    name: '',
    description: '',
    status: 'active',
    version: '1.0.0'
  });
  
  console.log('CreateLoaderDialog rendered, open:', open);
  
  if (!canCreate) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted!');
    console.log('Form data:', formData);

    try {
      console.log('Starting loader creation...');
      setLoading(true);
      const response = await createLoader(formData);
      if (response.success) {
        toast.success('Loader created successfully!');
        // Add a small delay to ensure cache invalidation is complete
        setTimeout(() => {
          onSuccess();
        }, 100);
        onOpenChange(false);
        // Reset form
        setFormData({
          name: '',
          description: '',
          status: 'active',
          version: '1.0.0'
        });
      } else {
        toast.error('Error creating loader');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error creating loader');
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
          <DialogTitle>Create New Loader</DialogTitle>
          <DialogDescription>
            Fill in the information for the new loader.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Loader name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Loader description"
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
              {loading ? 'Creating...' : 'Create Loader'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLoaderDialog;