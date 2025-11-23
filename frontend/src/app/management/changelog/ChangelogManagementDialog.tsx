import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { getProductChangelog, getAgentChangelog, deleteChangelogEntry } from '@/entities/changelog';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import { sanitizeString } from '@/lib/sanitization';
import ChangelogFormDialog from './ChangelogFormDialog';
import type { Product } from '@/entities/product';
import type { ChangelogEntry } from '@/entities/changelog';
import { Pencil, Trash2, Plus } from 'lucide-react';

interface ChangelogManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  isAgent?: boolean;
}

const ChangelogManagementDialog: React.FC<ChangelogManagementDialogProps> = ({
  open,
  onOpenChange,
  product,
  isAgent = false,
}) => {
  if (!product) {
    return null;
  }

  const { hasPermission } = usePermissions();

  const canViewChangelog = isAgent 
    ? hasPermission('agents.changelog_view') || hasPermission('products.changelog_view')
    : hasPermission('products.changelog_view');
  const canCreateChangelog = isAgent
    ? hasPermission('agents.changelog_create') || hasPermission('products.changelog_create')
    : hasPermission('products.changelog_create');
  const canEditChangelog = isAgent
    ? hasPermission('agents.changelog_edit') || hasPermission('products.changelog_edit')
    : hasPermission('products.changelog_edit');
  const canDeleteChangelog = isAgent
    ? hasPermission('agents.changelog_delete') || hasPermission('products.changelog_delete')
    : hasPermission('products.changelog_delete');

  if (!canViewChangelog) {
    return null;
  }

  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntry | null>(null);

  useEffect(() => {
    if (open && product) {
      loadChangelog();
    }
  }, [open, product?.id]);

  const loadChangelog = async () => {
    if (!product) return;

    try {
      setLoading(true);
      const response = isAgent 
        ? await getAgentChangelog(product.id)
        : await getProductChangelog(product.id);
      setChangelogEntries(response.changelog);
    } catch (error) {
      toast.error('Error loading changelog');
    } finally {
      setLoading(false);
    }
  };

  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const activeDeletesRef = useRef<Set<number>>(new Set());

  const handleDeleteEntry = useCallback(async (entryId: number) => {
    if (deletingIds.has(entryId) || activeDeletesRef.current.has(entryId)) {
      return;
    }

    if (!canDeleteChangelog) {
      toast.error('You do not have permission to delete changelog entries');
      return;
    }

    setDeletingIds(prev => new Set(prev).add(entryId));
    activeDeletesRef.current.add(entryId);

    try {
      await deleteChangelogEntry(entryId);
      setChangelogEntries(prev => prev.filter(entry => entry.id !== entryId));
      toast.success('Changelog entry deleted');
    } catch (error) {
      toast.error('Error deleting changelog entry');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
      activeDeletesRef.current.delete(entryId);
    }
  }, [deletingIds, canDeleteChangelog]);

  const handleEntryCreated = () => {
    loadChangelog();
  };

  const handleEntryUpdated = () => {
    loadChangelog();
    setEditingEntry(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const renderChanges = (changes: string[]) => {
    if (!changes || changes.length === 0) return null;

    return (
      <div className="mt-2">
        <ul className="text-sm text-muted-foreground space-y-1.5">
          {changes.map((change, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-primary/70 mt-1.5 text-[10px]">•</span>
              <span className="flex-1 break-words">{sanitizeString(change)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-base sm:text-lg">
            Changelog Management
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs truncate pr-4">
            Manage changelog for "{sanitizeString(product.name)}"
          </DialogDescription>
        </DialogHeader>

        {/* Main Body with Controls and List */}
        <div className="flex-1 flex flex-col min-h-0 bg-muted/10">
          
          {/* Controls Row */}
          <div className="flex items-center justify-between p-4 bg-background border-b shadow-sm z-10">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Entries 
              <Badge variant="secondary" className="text-xs h-5 px-1.5">{changelogEntries.length}</Badge>
            </h3>
            <ConditionalRender permission="products.changelog_create" fallback={null}>
              <Button 
                onClick={() => setShowCreateDialog(true)} 
                size="sm"
                className="h-8 gap-1"
                disabled={!canCreateChangelog}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Create Entry</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </ConditionalRender>
          </div>

          {/* Scrollable List Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Spinner className="h-6 w-6 mb-2" />
                <span className="text-xs">Loading entries...</span>
              </div>
            ) : changelogEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-background/50 mx-2">
                <p className="text-sm font-medium">No changelog entries yet</p>
                <p className="text-xs mt-1 text-center max-w-[200px]">Create the first update to keep users informed.</p>
              </div>
            ) : (
              changelogEntries.map((entry) => (
                <div 
                  key={entry.id} 
                  className="p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow relative group"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className="text-xs font-mono bg-primary/5 text-primary border-primary/20">
                          v{entry.version}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {formatDate(entry.release_date)}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold leading-relaxed mb-1 break-words">
                        {sanitizeString(entry.title)}
                      </h4>

                      {entry.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3 break-words border-l-2 border-muted pl-2 italic">
                          {sanitizeString(entry.description)}
                        </p>
                      )}

                      {renderChanges(entry.changes)}
                    </div>

                    <div className="flex flex-col gap-1">
                      <ConditionalRender permission="products.changelog_edit" fallback={null}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingEntry(entry)}
                          disabled={!canEditChangelog}
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </ConditionalRender>
                      <ConditionalRender permission="products.changelog_delete" fallback={null}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEntry(entry.id)}
                          disabled={deletingIds.has(entry.id) || !canDeleteChangelog}
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                          title="Delete"
                        >
                          {deletingIds.has(entry.id) ? (
                             <Spinner className="h-3 w-3" />
                          ) : (
                             <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </ConditionalRender>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="p-3 sm:p-4 border-t flex-shrink-0 bg-background">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            size="sm"
            className="w-full sm:w-auto min-w-[100px]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      <ChangelogFormDialog
        open={showCreateDialog || !!editingEntry}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingEntry(null);
          }
        }}
        product={product}
        entry={editingEntry}
        onEntryCreated={handleEntryCreated}
        onEntryUpdated={handleEntryUpdated}
        isAgent={isAgent}
      />
    </Dialog>
  );
};

export default ChangelogManagementDialog;