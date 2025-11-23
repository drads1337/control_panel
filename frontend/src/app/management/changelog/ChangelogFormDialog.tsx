import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';
import { createChangelogEntry, createAgentChangelogEntry, updateChangelogEntry } from '@/entities/changelog';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import type { Product } from '@/entities/product';
import type { ChangelogEntry, CreateChangelogData } from '@/entities/changelog';
import { parseChangelogEntry, parseReleaseDate, parseChanges } from '@/lib/validations/changelog';

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

const ChangelogFormDialog: React.FC<ChangelogFormDialogProps> = ({
  open,
  onOpenChange,
  product,
  entry,
  onEntryCreated,
  onEntryUpdated,
  onSave,
  isAgent = false,
}) => {
  const { hasPermission } = usePermissions();

  const isEditMode = !!entry;
  const canCreateChangelog = isAgent
    ? hasPermission('agents.changelog_create') || hasPermission('products.changelog_create')
    : hasPermission('products.changelog_create');
  const canEditChangelog = isAgent
    ? hasPermission('agents.changelog_edit') || hasPermission('products.changelog_edit')
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
        const validatedEntry = parseChangelogEntry(entry);
        if (validatedEntry) {
          setFormData({
            version: validatedEntry.version || '',
            title: validatedEntry.title || '',
            description: validatedEntry.description || '',
            changes: parseChanges(validatedEntry.changes).length > 0 
              ? parseChanges(validatedEntry.changes) 
              : [''],
            release_date: validatedEntry.release_date,
            is_public: validatedEntry.is_public !== undefined ? validatedEntry.is_public : true
          });

          const parsedDate = parseReleaseDate(validatedEntry.release_date);
          if (parsedDate) {
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
        } else {
          setFormData({
            version: entry.version || '',
            title: entry.title || '',
            description: entry.description || '',
            changes: entry.changes && entry.changes.length > 0 ? entry.changes : [''],
            release_date: entry.release_date || new Date().toISOString(),
            is_public: entry.is_public !== undefined ? entry.is_public : true
          });
          const parsedDate = parseReleaseDate(entry.release_date);
          if (parsedDate) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        const parsedDate = parseReleaseDate(`${dateStr}T${releaseTime}`);
        releaseDateISO = parsedDate ? parsedDate.toISOString() : new Date().toISOString();
      } else if (releaseDate) {
        const dateStr = releaseDate.toISOString().split('T')[0];
        const parsedDate = parseReleaseDate(`${dateStr}T00:00`);
        releaseDateISO = parsedDate ? parsedDate.toISOString() : new Date().toISOString();
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
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle className="text-base">
            {isEditMode ? 'Edit Changelog Entry' : 'Create Changelog Entry'}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs truncate pr-4">
            {isEditMode ? `Version ${entry?.version}` : product.name}
          </DialogDescription>
        </DialogHeader>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 mt-2">
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="version" className="text-sm font-medium">Version *</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0.0"
                  required
                  disabled={isEditMode || loading}
                  className={cn("text-base sm:text-sm", isEditMode && "bg-muted")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="releaseDate" className="text-sm font-medium">Release Date & Time</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 p-2 border rounded-md bg-muted/20">
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
                    <Label htmlFor="useCurrentTime" className="text-xs cursor-pointer">
                      Use current time
                    </Label>
                  </div>

                  {!useCurrentTime && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="releaseDate" className="text-xs text-muted-foreground mb-1 block">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal h-10 sm:h-9 text-sm",
                                !releaseDate && "text-muted-foreground"
                              )}
                              disabled={loading}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              <span className="truncate">
                                {releaseDate ? format(releaseDate, "PPP") : "Pick date"}
                              </span>
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
                      <div>
                        <Label htmlFor="releaseTime" className="text-xs text-muted-foreground mb-1 block">Time</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal h-10 sm:h-9 text-sm",
                                !releaseTime && "text-muted-foreground"
                              )}
                              disabled={loading}
                            >
                              <Clock className="mr-2 h-4 w-4" />
                              <span className="truncate">
                                {releaseTime || "Pick time"}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-4" align="end">
                            <div className="flex items-center gap-2">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Hour</Label>
                                <Select
                                  value={releaseHour}
                                  onValueChange={setReleaseHour}
                                  disabled={loading}
                                >
                                  <SelectTrigger className="w-[70px] h-9">
                                    <SelectValue placeholder="HH" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[200px]">
                                    {hours.map((hour) => (
                                      <SelectItem key={hour} value={hour}>
                                        {hour}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <span className="text-lg font-semibold mt-6">:</span>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Min</Label>
                                <Select
                                  value={releaseMinute}
                                  onValueChange={setReleaseMinute}
                                  disabled={loading}
                                >
                                  <SelectTrigger className="w-[70px] h-9">
                                    <SelectValue placeholder="MM" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[200px]">
                                    {minutes.map((minute) => (
                                      <SelectItem key={minute} value={minute}>
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
                        Release scheduled for: <span className="font-medium">{new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Brief description of the update"
                required
                className="w-full text-base sm:text-sm"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description of the changes"
                rows={3}
                className="resize-none w-full text-base sm:text-sm"
                disabled={loading}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">List of Changes *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addChange}
                  className="h-8"
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
                      className="flex-1 min-w-0 text-base sm:text-sm"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChange(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-10 w-10 sm:h-8 sm:w-8 p-0 flex-shrink-0"
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
          </div>

          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0 mt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel} 
              className="w-full sm:w-auto" 
              disabled={loading}
            >
              Cancel
            </Button>
            <ConditionalRender 
              permission={isEditMode 
                ? (isAgent ? 'agents.changelog_edit' : 'products.changelog_edit')
                : (isAgent ? 'agents.changelog_create' : 'products.changelog_create')
              } 
              fallback={null}
            >
              <Button 
                type="submit" 
                disabled={loading || !isFormValid} 
                onClick={handleSubmit}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    {isEditMode ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  isEditMode ? 'Save' : 'Create'
                )}
              </Button>
            </ConditionalRender>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangelogFormDialog;