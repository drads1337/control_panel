import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';
import { updateLicenseKey } from '@/entities/key';
import { toast } from 'sonner';
import { Edit2, Save, X } from 'lucide-react';
import type { LicenseKey } from '@/entities/key';
import { KEY_STATUS } from '@/constants';

interface KeyEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyData: LicenseKey | null;
  onSuccess: () => void;
}

const KeyEditDialog: React.FC<KeyEditDialogProps> = ({ open, onOpenChange, keyData, onSuccess }) => {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('keys.edit');
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    max_devices: 1,
    notes: '',
    status: 'active'
  });

  useEffect(() => {
    if (keyData) {
      setFormData({
        max_devices: keyData.max_devices || 1,
        notes: '',
        status: keyData.status === KEY_STATUS.ACTIVE ? 'active' : keyData.status === KEY_STATUS.BLOCKED ? 'inactive' : 'expired'
      });
    }
  }, [keyData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyData) return;

    if (!canEdit) {
      toast.error('You do not have permission to edit keys');
      return;
    }

    setLoading(true);
    try {
      await updateLicenseKey(keyData.id, {
        max_devices: formData.max_devices
      });
      
      toast.success('License key updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating license key:', error);
      toast.error('Error updating license key');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!keyData) return null;

  if (!canEdit) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5" />
            Edit License Key
          </DialogTitle>
          <DialogDescription>
            Update the properties of license key #{keyData.id}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="max_devices">Max Devices</Label>
            <Input
              id="max_devices"
              type="number"
              value={formData.max_devices}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                max_devices: parseInt(e.target.value) || 1 
              }))}
              min="1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add notes about this license key..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KeyEditDialog;
