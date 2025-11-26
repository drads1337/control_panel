import React, { useState, useEffect, useMemo } from 'react';
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
import { Spinner } from '@/components/ui/spinner';
import { usePermissions } from '@/hooks/use-permissions';
import { extendLicenseKey } from '@/entities/key';
import { toast } from 'sonner';
import type { LicenseKey } from '@/entities/key';
import { durationOptions } from './hooks/use-duration';

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

  // Convert duration options to format expected by this component (hours as string value)
  const extendDurationOptions = useMemo(() => {
    return durationOptions.map(option => ({
      value: option.hours.toString(),
      label: option.label
    }));
  }, []);

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

    if (hours > 8760) {
      toast.error('Hours must be 8760 or less (maximum 1 year)');
      return;
    }

    setLoading(true);
    try {
      await extendLicenseKey(keyData.id, hours);

      toast.success(`License key extended by ${hours} hours`);
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error extending license key';
      toast.error(errorMessage);
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
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle className="text-base">
            Extend License Key
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs truncate pr-4">
            Add more time to license key #{keyData.id}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 mt-2">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Duration</Label>
              <div className="p-2 bg-muted/20 rounded-md border">
                <p className="text-sm text-muted-foreground">
                  Current duration: <span className="font-medium text-foreground">{keyData.duration_hours} hours</span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Extension Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={extendType === 'hours' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExtendType('hours')}
                  disabled={loading}
                  className="h-9 flex-1"
                >
                  Custom Hours
                </Button>
                <Button
                  type="button"
                  variant={extendType === 'duration' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExtendType('duration')}
                  disabled={loading}
                  className="h-9 flex-1"
                >
                  Preset Duration
                </Button>
              </div>
            </div>

            {extendType === 'hours' ? (
              <div className="space-y-2">
                <Label htmlFor="customHours" className="text-sm font-medium">Custom Hours</Label>
                <Input
                  id="customHours"
                  type="number"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  placeholder="Enter number of hours"
                  min="1"
                  max="8760"
                  required
                  disabled={loading}
                  className="text-base sm:text-sm h-10 sm:h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum: 8760 hours (1 year)
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm font-medium">Select Duration</Label>
                <Select
                  value={selectedDuration}
                  onValueChange={setSelectedDuration}
                  disabled={loading}
                >
                  <SelectTrigger className="h-10 sm:h-9 text-base sm:text-sm">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {extendDurationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="p-3 bg-muted/50 rounded-lg border">
              <div className="text-sm">
                <span className="text-muted-foreground">
                  Total extension: <strong className="text-foreground">{getTotalHours()} hours</strong>
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                New total duration: <span className="font-medium">{keyData.duration_hours + getTotalHours()} hours</span>
              </div>
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
              disabled={loading || getTotalHours() <= 0 || getTotalHours() > 8760}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Extending...
                </>
              ) : (
                'Extend Key'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KeyExtendDialog;
