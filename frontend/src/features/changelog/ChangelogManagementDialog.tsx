"use client"

import * as React from "react"
import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Trash2, Clock } from 'lucide-react';
import { getProductChangelog, getAgentChangelog, deleteChangelogEntry } from '@/entities/changelog';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { toast } from 'sonner';
import { sanitizeString } from '@/lib/sanitization';
import ChangelogFormDialog from './ChangelogFormDialog';
import type { Product } from '@/entities/product';
import type { ChangelogEntry } from '@/entities/changelog';

interface ChangelogManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  isAgent?: boolean;
}

const changelogKeys = {
  all: ['changelog'] as const,
  product: (productId: number) => [...changelogKeys.all, 'product', productId] as const,
}

export default function ChangelogManagementDialog({
  open,
  onOpenChange,
  product,
  isAgent = false,
}: ChangelogManagementDialogProps) {
  const queryClient = useQueryClient();
  const { hasPermission, hasAnyPermission } = usePermissions();

  const canViewChangelog = isAgent 
    ? hasAnyPermission(['agents.changelog_view', 'products.changelog_view'])
    : hasPermission('products.changelog_view');
  const canCreateChangelog = isAgent
    ? hasAnyPermission(['agents.changelog_create', 'products.changelog_create'])
    : hasPermission('products.changelog_create');
  const canDeleteChangelog = isAgent
    ? hasAnyPermission(['agents.changelog_delete', 'products.changelog_delete'])
    : hasPermission('products.changelog_delete');

  // Allow dialog to open if user has at least one changelog permission (view, create, or edit)
  const canManageChangelog = isAgent
    ? hasAnyPermission(['agents.changelog_view', 'agents.changelog_create', 'agents.changelog_edit', 'products.changelog_view', 'products.changelog_create', 'products.changelog_edit'])
    : hasAnyPermission(['products.changelog_view', 'products.changelog_create', 'products.changelog_edit']);

  if (!canManageChangelog) {
    return null;
  }

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: changelogData, isLoading: loading } = useQuery({
    queryKey: changelogKeys.product(product?.id || 0),
    queryFn: async () => {
      if (!product) throw new Error('Product is required');
      return isAgent 
        ? await getAgentChangelog(product.id)
        : await getProductChangelog(product.id);
    },
    enabled: open && !!product && canManageChangelog,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403 || error?.response?.status === 429) {
        return false;
      }
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
  });

  const changelogEntries = changelogData?.changelog || [];

  const deleteChangelogMutation = useMutation({
    mutationFn: deleteChangelogEntry,
    onSuccess: () => {
      if (product) {
        queryClient.invalidateQueries({ queryKey: changelogKeys.product(product.id) });
      }
      toast.success('Changelog entry deleted');
    },
    onError: (error: any) => {
      toast.error('Error deleting changelog entry');
    },
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = changelogEntries.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: changelogEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 128,
    overscan: 3,
    enabled: true,
  });

  const handleDeleteEntry = useCallback(async (entryId: number) => {
    if (!canDeleteChangelog) {
      toast.error('You do not have permission to delete changelog entries');
      return;
    }

    deleteChangelogMutation.mutate(entryId);
  }, [canDeleteChangelog, deleteChangelogMutation]);

  const handleEntryCreated = useCallback(() => {
    if (product) {
      queryClient.invalidateQueries({ queryKey: changelogKeys.product(product.id) });
    }
  }, [product, queryClient]);

  if (!product) {
    return null;
  }

  if (!canManageChangelog) {
    return null;
  }

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-4xl p-0 gap-0 overflow-hidden max-h-[80vh]">
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Manage Changelog
            </DialogTitle>
            <DialogDescription className="text-xs">
              Make necessary changes to the settings for the product "{product.name}".
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-4 overflow-y-auto max-h-[calc(80vh-140px)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold">Changelog Entries ({changelogEntries.length})</h3>
            <ConditionalRender 
              permission={isAgent ? "agents.changelog_create" : "products.changelog_create"} 
              fallback={null}
            >
              <Button 
                onClick={() => setShowCreateDialog(true)} 
                className="h-8 text-xs"
                disabled={!canCreateChangelog}
              >
                Create
              </Button>
            </ConditionalRender>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="text-center">
                  <Spinner size="lg" className="mx-auto mb-4" />
                  <p className="text-xs text-muted-foreground">Loading changelog entries...</p>
                </div>
              </div>
            ) : changelogEntries.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-xs">No changelog entries found</p>
                <p className="text-xs">Create the first changelog entry for this product.</p>
              </div>
            ) : (
              <div 
                ref={parentRef}
                className="max-h-80 overflow-y-auto pr-2"
                style={shouldVirtualize ? { contain: 'strict' } : {}}
              >
                {shouldVirtualize ? (
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const entry = changelogEntries[virtualRow.index];
                      return (
                        <div
                          key={entry.id}
                          data-index={virtualRow.index}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                          className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors mb-2"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  v{entry.version}
                                </Badge>
                              </div>
                              <p className="text-xs font-medium leading-relaxed mb-2 break-words">
                                {sanitizeString(entry.title)}
                              </p>
                              {entry.description && (
                                <p className="text-xs text-muted-foreground leading-relaxed mb-2 break-words">
                                  {sanitizeString(entry.description)}
                                </p>
                              )}
                              {entry.changes && entry.changes.length > 0 && (
                                <ul className="text-xs text-muted-foreground space-y-1 mb-2">
                                  {entry.changes.slice(0, 3).map((change, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <span className="text-primary/70 mt-1.5 text-[10px]">•</span>
                                      <span className="flex-1 break-words">{sanitizeString(change)}</span>
                                    </li>
                                  ))}
                                  {entry.changes.length > 3 && (
                                    <li className="text-xs text-muted-foreground italic">
                                      +{entry.changes.length - 3} more
                                    </li>
                                  )}
                                </ul>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(entry.release_date)}
                                </div>
                              </div>
                            </div>
                            <ConditionalRender 
                              permission={isAgent ? "agents.changelog_delete" : "products.changelog_delete"} 
                              fallback={null}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteEntry(entry.id)}
                                disabled={deleteChangelogMutation.isPending || !canDeleteChangelog}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-7 w-7 p-0 disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </ConditionalRender>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {changelogEntries.map((entry) => (
                      <div 
                        key={entry.id} 
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                v{entry.version}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium leading-relaxed mb-2 break-words">
                              {sanitizeString(entry.title)}
                            </p>
                            {entry.description && (
                              <p className="text-xs text-muted-foreground leading-relaxed mb-2 break-words">
                                {sanitizeString(entry.description)}
                              </p>
                            )}
                            {entry.changes && entry.changes.length > 0 && (
                              <ul className="text-xs text-muted-foreground space-y-1 mb-2">
                                {entry.changes.map((change, index) => (
                                  <li key={index} className="flex items-start gap-2">
                                    <span className="text-primary/70 mt-1.5 text-[10px]">•</span>
                                    <span className="flex-1 break-words">{sanitizeString(change)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(entry.release_date)}
                              </div>
                            </div>
                          </div>
                          <ConditionalRender 
                            permission={isAgent ? "agents.changelog_delete" : "products.changelog_delete"} 
                            fallback={null}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEntry(entry.id)}
                              disabled={deleteChangelogMutation.isPending || !canDeleteChangelog}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-7 w-7 p-0 disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </ConditionalRender>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 mt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      <ChangelogFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        product={product}
        onEntryCreated={handleEntryCreated}
        isAgent={isAgent}
      />
    </Dialog>
  );
}

