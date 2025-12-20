import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Calendar, Tag } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { getProductChangelog, getAgentChangelog, deleteChangelogEntry } from '@/entities/changelog';
import { useAuth } from '@/lib/hooks';
import { usePermissions } from '@/lib/hooks';
import { ConditionalRender } from '@/lib/rbac/conditional-render';
import { formatDate as formatDateUtil } from '@/lib/utils/date-utils';
import { toast } from 'sonner';
import { sanitizeString } from '@/lib/utils/sanitization';
import ChangelogFormDialog from './ChangelogFormDialog';
import type { Product } from '@/entities/product';
import type { ChangelogEntry } from '@/entities/changelog';

interface ChangelogManagerProps {
  product: Product | null;
  onUpdate?: () => void;
  isAgent?: boolean;
}

const ChangelogManager: React.FC<ChangelogManagerProps> = ({ product, onUpdate, isAgent = false }) => {
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
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntry | null>(null);

  const loadChangelog = async () => {
    if (!product) return;

    try {
      setLoading(true);
      setError(null);
      const response = isAgent 
        ? await getAgentChangelog(product.id)
        : await getProductChangelog(product.id);
      setChangelog(response.changelog);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading changelog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChangelog();
  }, [product]);

  const handleCreateEntry = () => {
    setEditingEntry(null);
    setDialogOpen(true);
  };

  const handleEditEntry = (entry: ChangelogEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleDeleteEntry = async (entry: ChangelogEntry) => {
    if (!confirm(`Are you sure you want to delete the changelog entry "${entry.title}"?`)) {
      return;
    }

    try {
      await deleteChangelogEntry(entry.id);
      toast.success('Changelog entry deleted successfully');
      loadChangelog();
      onUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error deleting entry');
    }
  };

  const handleSaveEntry = (entry: ChangelogEntry) => {
    loadChangelog();
    onUpdate?.();
  };

  // Using centralized date formatting utility
  const formatDate = (dateString: string) => {
    return formatDateUtil(dateString, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!canViewChangelog) {
    return (
      <Alert>
        <AlertDescription>
          You don't have permission to view changelog.
        </AlertDescription>
      </Alert>
    );
  }

  if (!product) {
    return (
      <Alert>
        <AlertDescription>
          Select a product to view the changelog.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold break-words">Changelog: {sanitizeString(product.name)}</h3>
          <p className="text-sm text-muted-foreground">
            Manage changelog entries for the product.
          </p>
        </div>
        <ConditionalRender 
          permissions={isAgent 
            ? ['agents.changelog_create', 'products.changelog_create']
            : ['products.changelog_create']
          } 
          fallback={null}
        >
          <Button 
            onClick={handleCreateEntry} 
            disabled={!canCreateChangelog}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </ConditionalRender>
      </div>

      {loading && (
        <Spinner message="Loading changelogs..." />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {!loading && !error && changelog.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <div className="text-center space-y-2 px-4">
              <Tag className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">No changelog for this product yet</h3>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
                Create the first changelog entry to display the history of changes.
              </p>
              <ConditionalRender 
                permissions={isAgent 
                  ? ['agents.changelog_create', 'products.changelog_create']
                  : ['products.changelog_create']
                } 
                fallback={null}
              >
                <Button 
                  onClick={handleCreateEntry} 
                  className="mt-4 w-full sm:w-auto" 
                  disabled={!canCreateChangelog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Entry
                </Button>
              </ConditionalRender>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Changelog List */}
      {!loading && !error && changelog.length > 0 && (
        <div className="space-y-4">
          {changelog.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base sm:text-lg break-words">{sanitizeString(entry.title)}</CardTitle>
                      <Badge variant="secondary" className="shrink-0">{entry.version}</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2 text-xs sm:text-sm">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                      {formatDate(entry.release_date)}
                    </CardDescription>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 self-end sm:self-start shrink-0">
                    <ConditionalRender 
                      permissions={isAgent 
                        ? ['agents.changelog_edit', 'products.changelog_edit']
                        : ['products.changelog_edit']
                      } 
                      fallback={null}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditEntry(entry)}
                        disabled={!canEditChangelog}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </ConditionalRender>
                    <ConditionalRender 
                      permissions={isAgent 
                        ? ['agents.changelog_delete', 'products.changelog_delete']
                        : ['products.changelog_delete']
                      } 
                      fallback={null}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry)}
                        disabled={!canDeleteChangelog}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ConditionalRender>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3">
                {entry.description && (
                  <p className="text-sm text-muted-foreground break-words">{sanitizeString(entry.description)}</p>
                )}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Changes:</h4>
                  <ul className="space-y-1.5">
                    {entry.changes.map((change, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-1.5 text-[10px] sm:text-xs">•</span>
                        <span className="break-words flex-1">{sanitizeString(change)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ChangelogFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={product}
        entry={editingEntry}
        onSave={handleSaveEntry}
        onEntryCreated={() => handleSaveEntry(null as any)}
        onEntryUpdated={() => handleSaveEntry(null as any)}
        isAgent={isAgent}
      />
    </div>
  );
};

export default ChangelogManager;