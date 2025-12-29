"use client"

import * as React from "react"
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Bell } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { getProductNotifications, getAgentNotifications } from '@/entities/notification';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { toast } from 'sonner';
import { sanitizeString } from '@/lib/sanitization';
import NotificationsDialog from './NotificationsDialog';
import type { Product } from '@/entities/product';
import type { ProductNotification } from '@/entities/notification';

interface NotificationsManagerProps {
  product: Product | null;
  onUpdate?: () => void;
  isAgent?: boolean;
}

export default function NotificationsManager({ product, onUpdate, isAgent = false }: NotificationsManagerProps) {
  const { hasPermission, hasAnyPermission } = usePermissions();

  const canViewNotifications = isAgent 
    ? hasAnyPermission(['agents.notifications_view', 'products.notifications_view'])
    : hasPermission('products.notifications_view');
  const canCreateNotifications = isAgent
    ? hasAnyPermission(['agents.notifications_create', 'products.notifications_create'])
    : hasPermission('products.notifications_create');

  const [notifications, setNotifications] = useState<ProductNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadNotifications = async () => {
    if (!product) return;

    try {
      setLoading(true);
      setError(null);
      const response = isAgent 
        ? await getAgentNotifications(product.id)
        : await getProductNotifications(product.id);
      setNotifications(response.notifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [product]);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleNotificationCreated = () => {
    loadNotifications();
    onUpdate?.();
  };

  if (!canViewNotifications) {
    return (
      <Alert>
        <AlertDescription>
          You don't have permission to view notifications.
        </AlertDescription>
      </Alert>
    );
  }

  if (!product) {
    return (
      <Alert>
        <AlertDescription>
          Select a product to view notifications.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold break-words">Notifications: {sanitizeString(product.name)}</h3>
          <p className="text-xs text-muted-foreground">
            Manage notifications for the product.
          </p>
        </div>
        <ConditionalRender 
          permissions={isAgent 
            ? ['agents.notifications_create', 'products.notifications_create']
            : ['products.notifications_create']
          } 
          fallback={null}
        >
          <Button 
            onClick={handleOpenDialog} 
            disabled={!canCreateNotifications}
            className="w-full sm:w-auto h-8 text-xs"
          >
            <Plus className="h-3 w-3 mr-2" />
            Manage Notifications
          </Button>
        </ConditionalRender>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="text-center">
            <Spinner size="lg" className="mx-auto mb-4" />
            <p className="text-xs text-muted-foreground">Loading notifications...</p>
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
            <CardTitle className="text-base">Notification Summary</CardTitle>
            <CardDescription className="text-xs">
              Total notifications: {notifications.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <div className="text-center py-6">
                <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No notifications for this product yet</p>
                <ConditionalRender 
                  permissions={isAgent 
                    ? ['agents.notifications_create', 'products.notifications_create']
                    : ['products.notifications_create']
                  } 
                  fallback={null}
                >
                  <Button 
                    onClick={handleOpenDialog} 
                    className="mt-4 h-8 text-xs" 
                    disabled={!canCreateNotifications}
                    variant="outline"
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Create First Notification
                  </Button>
                </ConditionalRender>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  You have {notifications.length} notification{notifications.length !== 1 ? 's' : ''} for this product.
                </p>
                <Button 
                  onClick={handleOpenDialog} 
                  variant="outline"
                  className="w-full sm:w-auto h-8 text-xs"
                >
                  View All Notifications
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <NotificationsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={product}
        isAgent={isAgent}
      />
    </div>
  );
}