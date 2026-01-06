"use client"

import * as React from "react"
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils.ts';
import { createChangelogEntry, createAgentChangelogEntry, updateChangelogEntry } from '@/entities/changelog';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { toast } from 'sonner';
import type { Product } from '@/entities/product';
import type { ChangelogEntry, CreateChangelogData } from '@/entities/changelog';

interface ChangelogFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  entry?: ChangelogEntry | null;
  onEntryCreated?: () => void;
  onEntryUpdated?: () => void;
  onSave?: (entry: ChangelogEntry) => void;
  isAgent?: boolean;
}

export default function ChangelogFormDialog({
  open,
  onOpenChange,
  product,
  entry,
  onEntryCreated,
  onEntryUpdated,
  onSave,
  isAgent = false,
}: ChangelogFormDialogProps) {
  const { hasPermission, hasAnyPermission } = usePermissions();

  const isEditMode = !!entry;
  const canCreateChangelog = isAgent
    ? hasAnyPermission(['agents.changelog_create', 'products.changelog_create'])
    : hasPermission('products.changelog_create');
  const canEditChangelog = isAgent
    ? hasAnyPermission(['agents.changelog_edit', 'products.changelog_edit'])
    : hasPermission('products.changelog_edit');

  const hasPermissionForAction = isEditMode ? canEditChangelog : canCreateChangelog;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateChangelogData>({
    version: '',
    title: '',
    description: '',
    changes: [],
    release_date: new Date().toISOString(),
    is_public: true
  });
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(undefined);
  const [releaseTime, setReleaseTime] = useState('');
  const [releaseHour, setReleaseHour] = useState<string>('');
  const [releaseMinute, setReleaseMinute] = useState<string>('');

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  useEffect(() => {
    if (releaseHour && releaseMinute) {
      setReleaseTime(`${releaseHour}:${releaseMinute}`);
    } else if (!releaseHour && !releaseMinute) {
      setReleaseTime('');
    }
  }, [releaseHour, releaseMinute]);

  useEffect(() => {
    if (releaseTime && releaseTime.includes(':')) {
      const [hour, minute] = releaseTime.split(':');
      setReleaseHour(hour);
      setReleaseMinute(minute);
    } else if (!releaseTime) {
      setReleaseHour('');
      setReleaseMinute('');
    }
  }, [releaseTime]);

  useEffect(() => {
    if (open) {
      if (entry && isEditMode) {
        setFormData({
          version: entry.version || '',
          title: entry.title || '',
          description: entry.description || '',
          changes: entry.changes && entry.changes.length > 0 ? entry.changes : [''],
          release_date: entry.release_date || new Date().toISOString(),
          is_public: entry.is_public !== undefined ? entry.is_public : true
        });
        const parsedDate = new Date(entry.release_date);
        if (!isNaN(parsedDate.getTime())) {
          setReleaseDate(parsedDate);
          const timeStr = parsedDate.toTimeString().slice(0, 5);
          setReleaseTime(timeStr);
          const [hour, minute] = timeStr.split(':');
          setReleaseHour(hour);
          setReleaseMinute(minute);
          setUseCurrentTime(false);
        } else {
          const now = new Date();
          setReleaseDate(now);
          const timeStr = now.toTimeString().slice(0, 5);
          setReleaseTime(timeStr);
          const [hour, minute] = timeStr.split(':');
          setReleaseHour(hour);
          setReleaseMinute(minute);
          setUseCurrentTime(true);
        }
      } else if (product) {
        const now = new Date();
        setFormData({
          version: '',
          title: '',
          description: '',
          changes: [],
          release_date: now.toISOString(),
          is_public: true
        });
        setReleaseDate(now);
        const timeStr = now.toTimeString().slice(0, 5);
        setReleaseTime(timeStr);
        const [hour, minute] = timeStr.split(':');
        setReleaseHour(hour);
        setReleaseMinute(minute);
        setUseCurrentTime(true);
      }
    }
  }, [entry, open, product, isEditMode]);

  const handleSubmit = async () => {

    if (!product) {
      toast.error('Product is required');
      return;
    }

    if (!hasPermissionForAction) {
      toast.error(`You do not have permission to ${isEditMode ? 'edit' : 'create'} changelog entries`);
      return;
    }

    if (!formData.version?.trim() || !formData.title?.trim()) {
      toast.error('Version and title are required fields');
      return;
    }

    const filteredChanges = (formData.changes || []).filter(change => change.trim() !== '');

    if (filteredChanges.length === 0) {
      toast.error('Please add at least one change');
      return;
    }

    try {
      setLoading(true);

      let releaseDateISO: string;
      if (useCurrentTime) {
        releaseDateISO = new Date().toISOString();
      } else if (releaseDate && releaseTime) {
        const dateStr = releaseDate.toISOString().split('T')[0];
        const combinedDateTime = new Date(`${dateStr}T${releaseTime}`);
        releaseDateISO = !isNaN(combinedDateTime.getTime()) ? combinedDateTime.toISOString() : new Date().toISOString();
      } else if (releaseDate) {
        const dateStr = releaseDate.toISOString().split('T')[0];
        const combinedDateTime = new Date(`${dateStr}T00:00`);
        releaseDateISO = !isNaN(combinedDateTime.getTime()) ? combinedDateTime.toISOString() : new Date().toISOString();
      } else {
        releaseDateISO = new Date().toISOString();
      }

      const data: CreateChangelogData = {
        version: formData.version.trim(),
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        changes: filteredChanges,
        release_date: releaseDateISO,
        is_public: formData.is_public
      };

      if (isEditMode && entry) {
        const result = await updateChangelogEntry(entry.id, data);
        toast.success('Changelog entry updated successfully');
        onEntryUpdated?.();
        onSave?.(result.entry);
      } else {
        const result = isAgent
          ? await createAgentChangelogEntry(product.id, data)
          : await createChangelogEntry(product.id, data);
        toast.success('Changelog entry created successfully');
        onEntryCreated?.();
        onSave?.(result.entry);
      }

      onOpenChange(false);
    } catch (error) {
      // Error is handled in the API utility
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const addChange = () => {
    setFormData(prev => ({
      ...prev,
      changes: [...(prev.changes || []), '']
    }));
  };

  const removeChange = (index: number) => {
    setFormData(prev => ({
      ...prev,
      changes: (prev.changes || []).filter((_, i) => i !== index)
    }));
  };

  const updateChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      changes: (prev.changes || []).map((change, i) => i === index ? value : change)
    }));
  };

  if (!product) return null;

  if (!hasPermissionForAction) {
    return null;
  }

  const isFormValid = formData.version?.trim() && formData.title?.trim() && 
    (formData.changes || []).some(change => change.trim() !== '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[520px] p-0 gap-0 overflow-hidden max-h-[90vh]">
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              {isEditMode ? 'Edit Changelog Entry' : 'Create New Changelog Entry'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isEditMode ? `Version ${entry?.version}` : `Create a new changelog entry for the product "${product.name}"`}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="version" className="text-xs font-medium">Version *</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0.0"
                  required
                  disabled={isEditMode || loading}
                  className={cn("h-8 text-xs", isEditMode && "bg-muted")}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Release Date & Time</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="useCurrentTime"
                      checked={useCurrentTime}
                      onCheckedChange={(checked: boolean) => {
                        setUseCurrentTime(checked);
                        if (checked) {
                          const now = new Date();
                          setReleaseDate(now);
                          const timeStr = now.toTimeString().slice(0, 5);
                          setReleaseTime(timeStr);
                          const [hour, minute] = timeStr.split(':');
                          setReleaseHour(hour);
                          setReleaseMinute(minute);
                        } else {
                          setReleaseDate(undefined);
                          setReleaseTime('');
                          setReleaseHour('');
                          setReleaseMinute('');
                        }
                      }}
                      disabled={loading}
                    />
                    <Label htmlFor="useCurrentTime" className="text-xs">
                      Use current time
                    </Label>
                  </div>

                  {!useCurrentTime && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="releaseDate" className="text-xs text-muted-foreground">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal h-8 text-xs",
                                !releaseDate && "text-muted-foreground"
                              )}
                              disabled={loading}
                            >
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {releaseDate ? format(releaseDate, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={releaseDate}
                              onSelect={setReleaseDate}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="releaseTime" className="text-xs text-muted-foreground">Time</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal h-8 text-xs",
                                !releaseTime && "text-muted-foreground"
                              )}
                              disabled={loading}
                            >
                              <Clock className="mr-2 h-3 w-3" />
                              {releaseTime || "Pick a time"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-4" align="start">
                            <div className="flex items-center gap-2">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Hour</Label>
                                <Select
                                  value={releaseHour}
                                  onValueChange={setReleaseHour}
                                  disabled={loading}
                                >
                                  <SelectTrigger className="w-20 h-8 text-xs">
                                    <SelectValue placeholder="HH" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[200px] text-xs">
                                    {hours.map((hour) => (
                                      <SelectItem key={hour} value={hour} className="text-xs">
                                        {hour}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <span className="text-lg font-semibold mt-6">:</span>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Minute</Label>
                                <Select
                                  value={releaseMinute}
                                  onValueChange={setReleaseMinute}
                                  disabled={loading}
                                >
                                  <SelectTrigger className="w-20 h-8 text-xs">
                                    <SelectValue placeholder="MM" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[200px] text-xs">
                                    {minutes.map((minute) => (
                                      <SelectItem key={minute} value={minute} className="text-xs">
                                        {minute}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  {useCurrentTime && (
                    <div className="p-2 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground">
                        The changelog entry will be released at: <span className="font-medium">{new Date().toLocaleString('en-US')}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-medium">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Brief description of the update"
                required
                className="h-8 text-xs"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description of the changes"
                rows={3}
                className="resize-none text-xs"
                disabled={loading}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">List of Changes *</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addChange}
                  className="h-8 text-xs"
                  disabled={loading}
                >
                  Add Change
                </Button>
              </div>

              <div className="space-y-2">
                {(formData.changes || []).map((change, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={change}
                      onChange={(e) => updateChange(index, e.target.value)}
                      placeholder={`Change ${index + 1}`}
                      className="flex-1 min-w-0 h-8 text-xs"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeChange(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-8 w-8 p-0 flex-shrink-0"
                      disabled={loading}
                    >
                      <span className="text-lg">×</span>
                    </Button>
                  </div>
                ))}

                {(formData.changes || []).length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg bg-muted/10">
                    No changes listed yet. Click "Add Change" to start.
                  </div>
                )}
              </div>
            </div>

            {(formData.version?.trim() || formData.title?.trim() || (formData.changes || []).some(change => change.trim() !== '')) && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Preview</Label>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {formData.version?.trim() && (
                        <Badge variant="outline" className="text-xs">
                          v{formData.version.trim()}
                        </Badge>
                      )}
                    </div>
                    {formData.title?.trim() && (
                      <p className="text-xs font-medium">
                        {formData.title.trim()}
                      </p>
                    )}
                    {formData.description?.trim() && (
                      <p className="text-xs text-muted-foreground">
                        {formData.description.trim()}
                      </p>
                    )}
                    {(formData.changes || []).filter(change => change.trim() !== '').length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {(formData.changes || []).filter(change => change.trim() !== '').slice(0, 3).map((change, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-primary/70 mt-1.5 text-[10px]">•</span>
                            <span className="flex-1 break-words">{change}</span>
                          </li>
                        ))}
                        {(formData.changes || []).filter(change => change.trim() !== '').length > 3 && (
                          <li className="text-xs text-muted-foreground italic">
                            +{(formData.changes || []).filter(change => change.trim() !== '').length - 3} more
                          </li>
                        )}
                      </ul>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{useCurrentTime ? 'Now' : (releaseDate && releaseTime ? new Date(`${releaseDate.toISOString().split('T')[0]}T${releaseTime}`).toLocaleString('en-US') : 'Not specified')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 mt-4">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <ConditionalRender 
                permission={isAgent ? (isEditMode ? "agents.changelog_edit" : "agents.changelog_create") : (isEditMode ? "products.changelog_edit" : "products.changelog_create")} 
                fallback={null}
              >
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading || !isFormValid} 
                  className="h-8 text-xs min-w-[80px]"
                >
                  {loading ? (
                    <>
                      <Spinner className="mr-2 h-3 w-3" />
                      {isEditMode ? 'Saving...' : 'Creating...'}
                    </>
                  ) : (
                    isEditMode ? 'Save' : 'Create'
                  )}
                </Button>
              </ConditionalRender>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}