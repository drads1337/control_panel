import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Save, X, Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { createChangelogEntry, updateChangelogEntry } from '@/entities/changelog';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import type { Game } from '@/entities/game';
import type { ChangelogEntry, CreateChangelogData } from '@/entities/changelog';
import { parseChangelogEntry, parseReleaseDate, parseChanges } from '@/lib/validations/changelog';

interface ChangelogFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game | null;
  entry?: ChangelogEntry | null; // If provided, edit mode; otherwise, create mode
  onEntryCreated?: () => void;
  onEntryUpdated?: () => void;
  onSave?: (entry: ChangelogEntry) => void; // Legacy callback for backward compatibility
}

const ChangelogFormDialog: React.FC<ChangelogFormDialogProps> = ({
  open,
  onOpenChange,
  game,
  entry,
  onEntryCreated,
  onEntryUpdated,
  onSave,
}) => {
  const { hasPermission } = usePermissions();
  
  const isEditMode = !!entry;
  const canCreateChangelog = hasPermission('games.changelog_create');
  const canEditChangelog = hasPermission('games.changelog_edit');
  
  const hasPermissionForAction = isEditMode ? canEditChangelog : canCreateChangelog;
  
  // Early return if user doesn't have permission for this action
  if (!hasPermissionForAction) {
    return null;
  }
  
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
  const [releaseDate, setReleaseDate] = useState('');
  const [releaseTime, setReleaseTime] = useState('');

  // Initialize form when the dialog opens
  useEffect(() => {
    if (open) {
      if (entry && isEditMode) {
        // Edit mode: populate form with entry data using zod validation
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
          
          // Parse release date for date/time picker
          const parsedDate = parseReleaseDate(validatedEntry.release_date);
          if (parsedDate) {
            setReleaseDate(parsedDate.toISOString().split('T')[0]);
            setReleaseTime(parsedDate.toTimeString().slice(0, 5));
            setUseCurrentTime(false);
          } else {
            const now = new Date();
            setReleaseDate(now.toISOString().split('T')[0]);
            setReleaseTime(now.toTimeString().slice(0, 5));
            setUseCurrentTime(true);
          }
        } else {
          // Fallback if validation fails
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
            setReleaseDate(parsedDate.toISOString().split('T')[0]);
            setReleaseTime(parsedDate.toTimeString().slice(0, 5));
            setUseCurrentTime(false);
          } else {
            const now = new Date();
            setReleaseDate(now.toISOString().split('T')[0]);
            setReleaseTime(now.toTimeString().slice(0, 5));
            setUseCurrentTime(true);
          }
        }
      } else if (game) {
        // Create mode: reset form
        const now = new Date();
        setFormData({
          version: '',
          title: '',
          description: '',
          changes: [],
          release_date: now.toISOString(),
          is_public: true
        });
        setReleaseDate(now.toISOString().split('T')[0]);
        setReleaseTime(now.toTimeString().slice(0, 5));
        setUseCurrentTime(true);
      }
    }
  }, [entry, open, game, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!game) {
      toast.error('Game is required');
      return;
    }

    if (!hasPermissionForAction) {
      toast.error(`You do not have permission to ${isEditMode ? 'edit' : 'create'} changelog entries`);
      return;
    }

    // Validation
    if (!formData.version?.trim() || !formData.title?.trim()) {
      toast.error('Version and title are required fields');
      return;
    }

    // Filter out empty strings from changes
    const filteredChanges = (formData.changes || []).filter(change => change.trim() !== '');
    
    if (filteredChanges.length === 0) {
      toast.error('Please add at least one change');
      return;
    }

    try {
      setLoading(true);
      
      // Format release date based on useCurrentTime switch
      let releaseDateISO: string;
      if (useCurrentTime) {
        releaseDateISO = new Date().toISOString();
      } else if (releaseDate && releaseTime) {
        const parsedDate = parseReleaseDate(`${releaseDate}T${releaseTime}`);
        releaseDateISO = parsedDate ? parsedDate.toISOString() : new Date().toISOString();
      } else if (releaseDate) {
        const parsedDate = parseReleaseDate(`${releaseDate}T00:00`);
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
        // Update existing entry
        const result = await updateChangelogEntry(entry.id, data);
        toast.success('Changelog entry updated successfully');
        onEntryUpdated?.();
        onSave?.(result.entry);
      } else {
        // Create new entry
        const result = await createChangelogEntry(game.id, data);
        toast.success('Changelog entry created successfully');
        onEntryCreated?.();
        onSave?.(result.entry);
      }
      
      onOpenChange(false);
    } catch (error) {
      // Error is already handled by interceptor in enhanced-client.ts
      // No need to show toast.error() here - interceptor handles all API errors
      // Only log for debugging
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} changelog entry:`, error);
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

  if (!game) return null;
  
  if (!hasPermissionForAction) {
    return null;
  }

  const isFormValid = formData.version?.trim() && formData.title?.trim() && 
    (formData.changes || []).some(change => change.trim() !== '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEditMode ? 'Edit Changelog Entry' : 'Create Changelog Entry'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? `Version ${entry?.version}` : game.name}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto max-h-[calc(90vh-140px)] px-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="version">Version *</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0.0"
                required
                disabled={isEditMode || loading}
                className={isEditMode ? "bg-muted" : ""}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="releaseDate">Release Date and Time</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="useCurrentTime"
                    checked={useCurrentTime}
                    onCheckedChange={(checked: boolean) => {
                      setUseCurrentTime(checked);
                      if (checked) {
                        const now = new Date();
                        setReleaseDate(now.toISOString().split('T')[0]);
                        setReleaseTime(now.toTimeString().slice(0, 5));
                      }
                    }}
                    disabled={loading}
                  />
                  <Label htmlFor="useCurrentTime" className="text-sm cursor-pointer">
                    Use current time
                  </Label>
                </div>
                
                {!useCurrentTime && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="releaseDate" className="text-sm text-muted-foreground">Date</Label>
                      <Input
                        id="releaseDate"
                        type="date"
                        value={releaseDate}
                        onChange={(e) => setReleaseDate(e.target.value)}
                        disabled={loading}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="releaseTime" className="text-sm text-muted-foreground">Time</Label>
                      <Input
                        id="releaseTime"
                        type="time"
                        value={releaseTime}
                        onChange={(e) => setReleaseTime(e.target.value)}
                        disabled={loading}
                        className="h-9"
                      />
                    </div>
                  </div>
                )}
                
                {useCurrentTime && (
                  <div className="p-2 bg-muted/50 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      The release will be scheduled for: <span className="font-medium">{new Date().toLocaleString('en-US')}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Brief description of the update"
              required
              className="w-full"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detailed description of the changes"
              rows={3}
              className="resize-none w-full"
              disabled={loading}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>List of Changes *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addChange}
                className="h-8"
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            
            <div className="space-y-2">
              {(formData.changes || []).map((change, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={change}
                    onChange={(e) => updateChange(index, e.target.value)}
                    placeholder={`Change ${index + 1}`}
                    className="flex-1 min-w-0"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeChange(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-8 w-8 p-0 flex-shrink-0"
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {(formData.changes || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Click "Add" to create a list of changes
                </p>
              )}
            </div>
          </div>

        </form>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={handleCancel} className="w-full sm:w-auto" disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <ConditionalRender 
            permission={isEditMode ? 'games.changelog_edit' : 'games.changelog_create'} 
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
                  <Save className="h-4 w-4 mr-2 animate-pulse" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Save' : 'Create'}
                </>
              )}
            </Button>
          </ConditionalRender>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChangelogFormDialog;

