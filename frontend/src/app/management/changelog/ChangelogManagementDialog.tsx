import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { getProductChangelog, getAgentChangelog, deleteChangelogEntry } from '@/entities/changelog';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import ChangelogFormDialog from './ChangelogFormDialog';
import type { Product } from '@/entities/product';
import type { ChangelogEntry } from '@/entities/changelog';

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
      const result = await deleteChangelogEntry(entryId);

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
        <ul className="text-sm text-muted-foreground space-y-1">
          {changes.map((change, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">•</span>
              <span className="flex-1">{change}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] w-[90vw] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-base">
            Changelog Management
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Make necessary changes to the settings of the product "{product.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-1 px-1">
          <h3 className="text-sm font-semibold">Changelog Entries ({changelogEntries.length})</h3>
          <ConditionalRender permission="products.changelog_create" fallback={null}>
          <Button 
            onClick={() => setShowCreateDialog(true)} 
            size="sm"
            className="h-8"
            disabled={!canCreateChangelog}
          >
            Create
          </Button>
          </ConditionalRender>
        </div>

        <div className="space-y-4 overflow-y-auto max-h-[calc(80vh-120px)] pr-2">
          <div className="border rounded-lg p-4">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner className="h-4 w-4 mr-2" />
                <span className="text-xs">Loading changelog...</span>
              </div>
            ) : changelogEntries.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-xs">No changelog entries found</p>
                <p className="text-xs">Create the first changelog entry for this product</p>
              </div>
            ) : (
                <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                  {changelogEntries.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="text-xs font-mono">
                              v{entry.version}
                            </Badge>
                          </div>

                          <h4 className="text-sm font-semibold leading-relaxed mb-2 break-words">
                            {entry.title}
                          </h4>

                          {entry.description && (
                            <p className="text-sm text-muted-foreground leading-relaxed mb-2 break-words">
                              {entry.description}
                            </p>
                          )}

                          {renderChanges(entry.changes)}

                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mt-3">
                            <span>{formatDate(entry.release_date)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <ConditionalRender permission="products.changelog_edit" fallback={null}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingEntry(entry)}
                            disabled={!canEditChangelog}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 h-7 w-7 p-0"
                            aria-label="Edit changelog entry"
                          >
                            ✎
                          </Button>
                          </ConditionalRender>
                          <ConditionalRender permission="products.changelog_delete" fallback={null}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id)}
                            disabled={deletingIds.has(entry.id) || !canDeleteChangelog}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-7 w-7 p-0 disabled:opacity-50"
                            aria-label="Delete changelog entry"
                          >
                            ×
                          </Button>
                          </ConditionalRender>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            size="sm"
            className="h-8"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {}
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