import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { usePermissions } from '@/hooks/use-permissions';
import { updateLoader } from '@/entities/loader';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Loader, UpdateLoaderData } from '@/entities/loader';

interface EditLoaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  loader: Loader | null;
}

const EditLoaderDialog: React.FC<EditLoaderDialogProps> = ({ open, onOpenChange, onSuccess, loader }) => {
  const { token } = useAuth();
  const { hasPermission } = usePermissions();
  
  const canEditLoaders = hasPermission('loaders.edit');
  const canEditChangelog = hasPermission('loaders.changelog_edit') || hasPermission('changelog.edit');
  const canEditNotifications = hasPermission('loaders.notifications_edit') || hasPermission('notifications.edit');
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdateLoaderData>({
    name: '',
    description: '',
    status: 'active',
    version: '1.0.0',
    changelog: '',
    notifications: ''
  });

  useEffect(() => {
    if (loader) {
      setFormData({
        name: loader.name,
        description: loader.description,
        status: loader.status,
        version: loader.version,
        changelog: loader.changelog || '',
        notifications: loader.notifications || ''
      });
    }
  }, [loader]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !loader) return;

    if (!canEditLoaders) {
      toast.error('You do not have permission to edit loaders');
      return;
    }

    try {
      setLoading(true);
      await updateLoader(loader.id, formData);
      toast.success('Loader updated successfully!');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating loader');
    } finally {
      setLoading(false);
    }
  };

  if (!loader) return null;
  
  if (!canEditLoaders) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Loader</DialogTitle>
          <DialogDescription>
            Edit the information for the loader "{loader.name}".
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
                placeholder="Loader Name"
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
              placeholder="Detailed description of the loader"
              rows={3}
              required
            />
          </div>
          
          <ConditionalRender permission="loaders.changelog_edit" fallback={null}>
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
          
          <ConditionalRender permission="loaders.notifications_edit" fallback={null}>
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
            <Button type="submit" disabled={loading || !formData.name || !formData.description}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditLoaderDialog;