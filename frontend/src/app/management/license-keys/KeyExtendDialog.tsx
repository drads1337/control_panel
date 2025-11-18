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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';
import { extendLicenseKey } from '@/entities/key';
import { toast } from 'sonner';
import { Clock, Plus, X } from 'lucide-react';
import type { LicenseKey } from '@/entities/key';

interface KeyExtendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyData: LicenseKey | null;
  onSuccess: () => void;
}

const KeyExtendDialog: React.FC<KeyExtendDialogProps> = ({ open, onOpenChange, keyData, onSuccess }) => {
  const { hasPermission } = usePermissions();
  const canExtend = hasPermission('keys.extend');

  const [loading, setLoading] = useState(false);
  const [extendType, setExtendType] = useState<'hours' | 'duration'>('hours');
  const [customHours, setCustomHours] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('24');

  const durationOptions = [
    { value: '1', label: '1 hour' },
    { value: '6', label: '6 hours' },
    { value: '12', label: '12 hours' },
    { value: '24', label: '1 day' },
    { value: '72', label: '3 days' },
    { value: '168', label: '1 week' },
    { value: '336', label: '2 weeks' },
    { value: '720', label: '1 month' },
    { value: '1440', label: '2 months' },
    { value: '2160', label: '3 months' },
    { value: '4320', label: '6 months' },
    { value: '8760', label: '1 year' }
  ];

  useEffect(() => {
    if (open) {
      setExtendType('hours');
      setCustomHours('');
      setSelectedDuration('24');
    }
  }, [open]);

  const getTotalHours = () => {
    if (extendType === 'hours') {
      return parseInt(customHours) || 0;
    } else {
      return parseInt(selectedDuration) || 0;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyData) return;

    if (!canExtend) {
      toast.error('You do not have permission to extend keys');
      return;
    }

    const hours = getTotalHours();
    if (hours <= 0) {
      toast.error('Please enter a valid number of hours');
      return;
    }

    setLoading(true);
    try {
      await extendLicenseKey(keyData.id, hours);

      toast.success(`License key extended by ${hours} hours`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {

      toast.error('Error extending license key');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!keyData) return null;

  if (!canExtend) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Extend License Key
          </DialogTitle>
          <DialogDescription>
            Add more time to license key #{keyData.id}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Current Duration</Label>
            <p className="text-sm text-muted-foreground">
              Current duration: {keyData.duration_hours} hours
            </p>
          </div>

          <div className="space-y-2">
            <Label>Extension Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={extendType === 'hours' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setExtendType('hours')}
              >
                Custom Hours
              </Button>
              <Button
                type="button"
                variant={extendType === 'duration' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setExtendType('duration')}
              >
                Preset Duration
              </Button>
            </div>
          </div>

          {extendType === 'hours' ? (
            <div className="space-y-2">
              <Label htmlFor="customHours">Custom Hours</Label>
              <Input
                id="customHours"
                type="number"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                placeholder="Enter number of hours"
                min="1"
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="duration">Select Duration</Label>
              <Select
                value={selectedDuration}
                onValueChange={setSelectedDuration}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" />
              <span>Total extension: <strong>{getTotalHours()} hours</strong></span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              New total duration: {keyData.duration_hours + getTotalHours()} hours
            </div>
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
              disabled={loading || getTotalHours() <= 0}
            >
              <Clock className="h-4 w-4 mr-2" />
              {loading ? 'Extending...' : 'Extend Key'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KeyExtendDialog;
