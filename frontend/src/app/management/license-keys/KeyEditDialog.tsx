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
import { Spinner } from '@/components/ui/spinner';
import { usePermissions } from '@/hooks/use-permissions';
import { updateLicenseKey } from '@/entities/key';
import { toast } from 'sonner';
import type { LicenseKey } from '@/entities/key';

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
    notes: ''
  });

  useEffect(() => {
    if (keyData) {
      setFormData({
        max_devices: keyData.max_devices || 1,
        notes: ''
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
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle className="text-base">
            Edit License Key
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs truncate pr-4">
            Update the properties of license key #{keyData.id}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 mt-2">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max_devices" className="text-sm font-medium">Max Devices</Label>
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
                disabled={loading}
                className="text-base sm:text-sm h-10 sm:h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add notes about this license key..."
                rows={3}
                disabled={loading}
                className="resize-none w-full text-base sm:text-sm"
              />
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KeyEditDialog;
