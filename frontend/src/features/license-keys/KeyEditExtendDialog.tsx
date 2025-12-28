import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { extendLicenseKey, updateLicenseKey } from '@/entities/key';
import { toast } from 'sonner';
import type { LicenseKey } from '@/entities/key';
import { durationOptions } from './hooks/use-duration';

interface KeyEditExtendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyData: LicenseKey | null;
  onSuccess: () => void;
  initialTab?: 'edit' | 'extend';
}

const KeyEditExtendDialog: React.FC<KeyEditExtendDialogProps> = ({ 
  open, 
  onOpenChange, 
  keyData, 
  onSuccess,
  initialTab = 'extend'
}) => {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('keys.edit');
  const canExtend = hasPermission('keys.extend');

  // Determine available tabs
  const showEdit = canEdit;
  const showExtend = canExtend;
  const showTabsUI = showEdit && showExtend;

  const [activeTab, setActiveTab] = useState<'edit' | 'extend'>(initialTab);
  const [loading, setLoading] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({ max_devices: 1, notes: '' });

  // Extend form state
  const [extendType, setExtendType] = useState<'duration' | 'hours'>('duration');
  const [customHours, setCustomHours] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('24');

  // Reset state on open
  useEffect(() => {
    if (open && keyData) {
      // If the requested initial tab isn't allowed, switch to the one that is
      let effectiveTab = initialTab;
      if (initialTab === 'edit' && !showEdit && showExtend) effectiveTab = 'extend';
      if (initialTab === 'extend' && !showExtend && showEdit) effectiveTab = 'edit';
      
      setActiveTab(effectiveTab);

      setEditForm({
        max_devices: keyData.max_devices || 1,
        notes: '' // Assuming notes might come from API later
      });
      setExtendType('duration');
      setCustomHours('');
      setSelectedDuration('24');
    }
  }, [open, keyData, initialTab, showEdit, showExtend]);

  const getTotalHours = () => {
    return extendType === 'hours' ? (parseInt(customHours) || 0) : (parseInt(selectedDuration) || 0);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyData || !canEdit) return;

    setLoading(true);
    try {
      await updateLicenseKey(keyData.id, { max_devices: editForm.max_devices });
      toast.success('License key updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error('Error updating license key');
    } finally {
      setLoading(false);
    }
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyData || !canExtend) return;

    const hours = getTotalHours();
    if (hours <= 0) { toast.error('Invalid hours'); return; }
    if (hours > 8760) { toast.error('Max 8760 hours (1 year)'); return; }

    setLoading(true);
    try {
      await extendLicenseKey(keyData.id, hours);
      toast.success(`Extended by ${hours} hours`);
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error extending key');
    } finally {
      setLoading(false);
    }
  };

  if (!keyData || (!showEdit && !showExtend)) return null;

  const currentDuration = keyData.duration_hours;
  const addedHours = getTotalHours();
  const newTotal = currentDuration + addedHours;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        
        {/* Header */}
        <DialogHeader className="p-4 pb-2 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-base font-semibold">
              {activeTab === 'edit' ? 'Edit License Key' : 'Extend License Key'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {activeTab === 'edit' 
                ? `Update properties for key #${keyData.id}`
                : `Add duration to key #${keyData.id}`
              }
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Tabs Container */}
        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as 'edit' | 'extend')} 
          className="w-full"
        >
          {showTabsUI && (
            <TabsList className="w-full rounded-none bg-transparent h-9 p-0">
              <TabsTrigger 
                value="extend"
                className="flex-1 h-9 rounded-none text-xs data-[state=active]:bg-transparent"
              >
                Extend Duration
              </TabsTrigger>
              <TabsTrigger 
                value="edit" 
                className="flex-1 h-9 rounded-none text-xs data-[state=active]:bg-transparent"
              >
                Edit Details
              </TabsTrigger>
            </TabsList>
          )}

          <div className="p-4">
            {/* EXTEND CONTENT */}
            <TabsContent value="extend" className="mt-0 space-y-4">
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="max_devices" className="text-xs font-medium">
                      Max Devices
                    </Label>
                    <Input
                      id="max_devices"
                      type="number"
                      value={editForm.max_devices}
                      onChange={(e) => setEditForm(p => ({ ...p, max_devices: parseInt(e.target.value) || 1 }))}
                      min="1"
                      required
                      disabled={loading}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-xs font-medium">
                      Notes
                    </Label>
                    <Textarea
                      id="notes"
                      value={editForm.notes}
                      onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Optional notes..."
                      rows={3}
                      disabled={loading}
                      className="resize-none w-full text-xs min-h-[80px]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="h-8 text-xs min-w-[80px]">
                    {loading ? <Spinner className="h-3 w-3" /> : 'Save'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* EDIT CONTENT */}
            <TabsContent value="edit" className="mt-0 space-y-4">
              <form onSubmit={handleExtendSubmit} className="space-y-4">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-md text-xs">
                  <span className="text-muted-foreground">Current Duration:</span>
                  <span className="font-medium font-mono">{currentDuration} hrs</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Method</Label>
                    <ToggleGroup
                      type="single"
                      value={extendType}
                      onValueChange={(val) => val && setExtendType(val as 'duration' | 'hours')}
                      className="flex w-full gap-1"
                    >
                      <ToggleGroupItem value="duration" className="flex-1 h-8 text-xs">
                        Preset
                      </ToggleGroupItem>
                      <ToggleGroupItem value="hours" className="flex-1 h-8 text-xs">
                        Custom
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      {extendType === 'duration' ? 'Select Duration' : 'Enter Hours'}
                    </Label>
                    {extendType === 'duration' ? (
                      <div className="grid grid-cols-4 gap-1.5">
                        {durationOptions.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={selectedDuration === option.hours.toString() ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedDuration(option.hours.toString())}
                            disabled={loading}
                            className="text-[10px] h-8 px-0 w-full"
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          type="number"
                          value={customHours}
                          onChange={(e) => setCustomHours(e.target.value)}
                          placeholder="48"
                          min="1"
                          max="8760"
                          disabled={loading}
                          className="h-8 text-xs font-mono"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">hrs</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1">
                    <div className="rounded-md bg-muted/10 p-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">Current</span>
                          <span className="font-mono">{currentDuration}h</span>
                        </div>
                        <span className="text-muted-foreground font-light text-lg leading-none">+</span>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">Adding</span>
                          <span className="font-mono font-semibold text-primary">+{addedHours}h</span>
                        </div>
                        <span className="text-muted-foreground font-light text-lg leading-none">=</span>
                        <div className="flex flex-col text-right">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-mono font-bold">{newTotal}h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || addedHours <= 0 || addedHours > 8760} className="h-8 text-xs min-w-[80px]">
                    {loading ? <Spinner className="h-3 w-3" /> : 'Confirm'}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default KeyEditExtendDialog;