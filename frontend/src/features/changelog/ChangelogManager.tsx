"use client"

import * as React from "react"
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Tag } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { getProductChangelog, getAgentChangelog } from '@/entities/changelog';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { AccessDenied } from '@/shared/ui/components';
import { useAuthContext } from '@/app/providers/auth-provider';
import { toast } from 'sonner';
import { sanitizeString } from '@/lib/sanitization';
import ChangelogManagementDialog from './ChangelogManagementDialog';
import type { Product } from '@/entities/product';
import type { ChangelogEntry } from '@/entities/changelog';

interface ChangelogManagerProps {
  product: Product | null;
  onUpdate?: () => void;
  isAgent?: boolean;
}

export default function ChangelogManager({ product, onUpdate, isAgent = false }: ChangelogManagerProps) {
  const { user, isAuthenticated, isInitialized } = useAuthContext();
  const { hasPermission, hasAnyPermission } = usePermissions();

  const canViewChangelog = isAgent 
    ? hasAnyPermission(['agents.changelog_view', 'products.changelog_view'])
    : hasPermission('products.changelog_view');
  const canCreateChangelog = isAgent
    ? hasAnyPermission(['agents.changelog_create', 'products.changelog_create'])
    : hasPermission('products.changelog_create');

  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleEntryCreated = () => {
    loadChangelog();
    onUpdate?.();
  };

  if (!isInitialized) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return (
      <AccessDenied
        isAuthenticated={false}
        hasAccess={false}
        user={user}
        message="You need to be logged in to view changelog."
        useCard={true}
      />
    );
  }

  if (!canViewChangelog) {
    return (
      <AccessDenied
        isAuthenticated={true}
        hasAccess={false}
        user={user}
        message="You don't have permission to view changelog."
        useCard={true}
      />
    );
  }

  if (!product) {
    return (
      <Alert>
        <AlertDescription>
          Select a product to view changelog.
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
          <p className="text-xs text-muted-foreground">
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
            onClick={handleOpenDialog} 
            disabled={!canCreateChangelog}
            className="w-full sm:w-auto h-8 text-xs"
          >
            <Plus className="h-3 w-3 mr-2" />
            Manage Changelog
          </Button>
        </ConditionalRender>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="text-center">
            <Spinner size="lg" className="mx-auto mb-4" />
            <p className="text-xs text-muted-foreground">Loading changelog...</p>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Card */}
      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Changelog Summary</CardTitle>
            <CardDescription className="text-xs">
              Total entries: {changelog.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {changelog.length === 0 ? (
              <div className="text-center py-6">
                <Tag className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No changelog entries for this product yet</p>
                <ConditionalRender 
                  permissions={isAgent 
                    ? ['agents.changelog_create', 'products.changelog_create']
                    : ['products.changelog_create']
                  } 
                  fallback={null}
                >
                  <Button 
                    onClick={handleOpenDialog} 
                    className="mt-4 h-8 text-xs" 
                    disabled={!canCreateChangelog}
                    variant="outline"
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Create First Entry
                  </Button>
                </ConditionalRender>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  You have {changelog.length} changelog entr{changelog.length !== 1 ? 'ies' : 'y'} for this product.
                </p>
                <Button 
                  onClick={handleOpenDialog} 
                  variant="outline"
                  className="w-full sm:w-auto h-8 text-xs"
                >
                  View All Entries
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ChangelogManagementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={product}
        isAgent={isAgent}
      />
    </div>
  );
}

