import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Calendar, Tag } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { getProductChangelog, deleteChangelogEntry } from '@/entities/changelog';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import { sanitizeString } from '@/lib/sanitization';
import ChangelogFormDialog from './ChangelogFormDialog';
import type { Product } from '@/entities/product';
import type { ChangelogEntry } from '@/entities/changelog';

interface ChangelogManagerProps {
  product: Product | null;
  onUpdate?: () => void;
}

const ChangelogManager: React.FC<ChangelogManagerProps> = ({ product, onUpdate }) => {
  const { hasPermission } = usePermissions();

  const canViewChangelog = hasPermission('changelog.view');
  const canCreateChangelog = hasPermission('changelog.create');
  const canEditChangelog = hasPermission('changelog.edit');
  const canDeleteChangelog = hasPermission('changelog.delete');
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
      const response = await getProductChangelog(product.id);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Changelog: {sanitizeString(product.name)}</h3>
          <p className="text-sm text-muted-foreground">
            Manage changelog entries for the product.
          </p>
        </div>
        <ConditionalRender permission="changelog.create" fallback={null}>
          <Button onClick={handleCreateEntry} disabled={!canCreateChangelog}>
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

      {!loading && !error && changelog.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Tag className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">No changelog for this product yet</h3>
              <p className="text-muted-foreground">
                Create the first changelog entry to display the history of changes.
              </p>
              <ConditionalRender permission="changelog.create" fallback={null}>
                <Button onClick={handleCreateEntry} className="mt-4" disabled={!canCreateChangelog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Entry
                </Button>
              </ConditionalRender>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && changelog.length > 0 && (
        <div className="space-y-4">
          {changelog.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{sanitizeString(entry.title)}</CardTitle>
                      <Badge variant="secondary">{entry.version}</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(entry.release_date)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <ConditionalRender permission="changelog.edit" fallback={null}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditEntry(entry)}
                        disabled={!canEditChangelog}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </ConditionalRender>
                    <ConditionalRender permission="changelog.delete" fallback={null}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry)}
                        disabled={!canDeleteChangelog}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ConditionalRender>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {entry.description && (
                  <p className="text-sm text-muted-foreground">{sanitizeString(entry.description)}</p>
                )}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Changes:</h4>
                  <ul className="space-y-1">
                    {entry.changes.map((change, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{sanitizeString(change)}</span>
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
      />
    </div>
  );
};

export default ChangelogManager;