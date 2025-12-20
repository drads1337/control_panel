import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Eye, EyeOff, Trash2, Clock } from 'lucide-react';
import { getProductNotifications, getAgentNotifications, deleteNotification } from '@/entities/notification';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import CreateNotificationDialog from './CreateNotificationDialog';
import type { Product } from '@/entities/product';
import type { ProductNotification } from '@/entities/notification';

interface NotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  isAgent?: boolean;
}

const notificationKeys = {
  all: ['notifications'] as const,
  product: (productId: number) => [...notificationKeys.all, 'product', productId] as const,
}

const NotificationsDialog: React.FC<NotificationsDialogProps> = ({
  open,
  onOpenChange,
  product,
  isAgent = false,
}) => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  const canViewNotifications = isAgent 
    ? hasPermission('agents.notifications_view') || hasPermission('products.notifications_view')
    : hasPermission('products.notifications_view');
  const canCreateNotifications = isAgent
    ? hasPermission('agents.notifications_create') || hasPermission('products.notifications_create')
    : hasPermission('products.notifications_create');
  const canDeleteNotifications = isAgent
    ? hasPermission('agents.notifications_delete') || hasPermission('products.notifications_delete')
    : hasPermission('products.notifications_delete');

  // Allow dialog to open if user has at least one notification permission (view, create, or edit)
  const canManageNotifications = isAgent
    ? hasPermission('agents.notifications_view') || 
      hasPermission('agents.notifications_create') || 
      hasPermission('agents.notifications_edit') ||
      hasPermission('products.notifications_view') || 
      hasPermission('products.notifications_create') || 
      hasPermission('products.notifications_edit')
    : hasPermission('products.notifications_view') || 
      hasPermission('products.notifications_create') || 
      hasPermission('products.notifications_edit');

  if (!canManageNotifications) {
    return null;
  }

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: notificationsData, isLoading: loading } = useQuery({
    queryKey: notificationKeys.product(product?.id || 0),
    queryFn: async () => {
      if (!product) throw new Error('Product is required');
      return isAgent 
        ? await getAgentNotifications(product.id)
        : await getProductNotifications(product.id);
    },
    enabled: open && !!product && canManageNotifications,
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

  const notifications = notificationsData?.notifications || [];

  const deleteNotificationMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {

      if (product) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.product(product.id) });
      }
      toast.success('Notification deleted');
    },
    onError: (error: any) => {

      toast.error('Error deleting notification');
    },
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = notifications.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: notifications.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 128,
    overscan: 3,
    enabled: true,
  });

  const handleDeleteNotification = useCallback(async (notificationId: number) => {
    if (!canDeleteNotifications) {
      toast.error('You do not have permission to delete notifications');
      return;
    }

    deleteNotificationMutation.mutate(notificationId);
  }, [canDeleteNotifications, deleteNotificationMutation]);

  const handleNotificationCreated = useCallback(() => {

    if (product) {
      queryClient.invalidateQueries({ queryKey: notificationKeys.product(product.id) });
    }
  }, [product, queryClient]);

  if (!product) {
    return null;
  }

  // Allow dialog to open if user has at least one notification permission (view, create, or edit)
  if (!canManageNotifications) {
    return null;
  }

  const getTypeBadge = (type: string) => {
    const colors = {
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    };

    const getTypeLabel = (type: string) => {
      switch (type) {
        case 'info': return 'Info';
        case 'warning': return 'Warning';
        case 'error': return 'Error';
        case 'success': return 'Success';
        default: return type;
      }
    };

    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'}>
        {getTypeLabel(type)}
      </Badge>
    );
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] w-[90vw] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-base">
            Manage Notifications
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Make necessary changes to the settings for the product "{product.name}".
          </DialogDescription>
        </DialogHeader>

        {}
        <div className="flex items-center justify-between mb-1 px-1">
          <h3 className="text-sm font-semibold">Notifications ({notifications.length})</h3>
          <ConditionalRender 
            permission={isAgent ? "agents.notifications_create" : "products.notifications_create"} 
            fallback={null}
          >
          <Button 
            onClick={() => setShowCreateDialog(true)} 
            size="sm"
            className="h-8"
            disabled={!canCreateNotifications}
          >
            Create
          </Button>
          </ConditionalRender>
        </div>

        <div className="space-y-4 overflow-y-auto max-h-[calc(80vh-120px)] pr-2">
          <div className="border rounded-lg p-4">
            {loading ? (
              <Spinner message="Loading notifications..." />
            ) : notifications.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-xs">No notifications found</p>
                <p className="text-xs">Create the first notification for this product.</p>
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
                        const notification = notifications[virtualRow.index];
                        return (
                          <div
                            key={notification.id}
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
                                    {getTypeBadge(notification.type)}
                                    {typeof notification.is_read !== 'undefined' && (
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${
                                          notification.is_read 
                                            ? 'text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800' 
                                            : 'text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800'
                                        }`}
                                      >
                                        {notification.is_read ? 'Read' : 'Unread'}
                                      </Badge>
                                    )}
                                    {typeof notification.show_count !== 'undefined' && 
                                     typeof notification.repeat_count !== 'undefined' &&
                                     notification.show_count >= notification.repeat_count && (
                                      <Badge variant="secondary" className="text-xs">
                                        Completed
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium leading-relaxed mb-2 break-words">
                                    {notification.message}
                                  </p>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                    <span>{formatDate(notification.created_at)}</span>
                                    {typeof notification.repeat_count !== 'undefined' && (
                                      <span className="flex items-center gap-1">
                                        <span>Repeats:</span>
                                        <span className="font-medium">
                                          {notification.repeat_count}
                                        </span>
                                      </span>
                                    )}
                                    {notification.user_count && notification.user_count > 1 && (
                                      <span className="flex items-center gap-1">
                                        <span>Users:</span>
                                        <span className="font-medium text-blue-600">
                                          {notification.user_count}
                                        </span>
                                      </span>
                                    )}
                                    {isAgent && notification.sent_at && (
                                      <span className="flex items-center gap-1">
                                        <span>Sent:</span>
                                        <span className="font-medium">
                                          {formatDate(notification.sent_at)}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ConditionalRender 
                              permission={isAgent ? "agents.notifications_delete" : "products.notifications_delete"} 
                              fallback={null}
                            >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteNotification(notification.id)}
                                  disabled={deleteNotificationMutation.isPending || !canDeleteNotifications}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-7 w-7 p-0 disabled:opacity-50"
                                >
                                  ×
                                </Button>
                                </ConditionalRender>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {getTypeBadge(notification.type)}
                                {typeof notification.is_read !== 'undefined' && (
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${
                                      notification.is_read 
                                        ? 'text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800' 
                                        : 'text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800'
                                    }`}
                                  >
                                    {notification.is_read ? (
                                      <>
                                        <Eye className="h-3 w-3 mr-1" />
                                        Read
                                      </>
                                    ) : (
                                      <>
                                        <EyeOff className="h-3 w-3 mr-1" />
                                        Unread
                                      </>
                                    )}
                                  </Badge>
                                )}
                                {typeof notification.show_count !== 'undefined' && 
                                 typeof notification.repeat_count !== 'undefined' &&
                                 notification.show_count >= notification.repeat_count && (
                                  <Badge variant="secondary" className="text-xs">
                                    Completed
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium leading-relaxed mb-2 break-words">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(notification.created_at)}
                                </div>
                                {typeof notification.repeat_count !== 'undefined' && (
                                  <span className="flex items-center gap-1">
                                    <span>Repeats:</span>
                                    <span className="font-medium">
                                      {notification.repeat_count}
                                    </span>
                                  </span>
                                )}
                                {notification.user_count && notification.user_count > 1 && (
                                  <span className="flex items-center gap-1">
                                    <span>Users:</span>
                                    <span className="font-medium text-blue-600">
                                      {notification.user_count}
                                    </span>
                                  </span>
                                )}
                                {isAgent && notification.sent_at && (
                                  <span className="flex items-center gap-1">
                                    <span>Sent:</span>
                                    <span className="font-medium">
                                      {formatDate(notification.sent_at)}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <ConditionalRender 
                              permission={isAgent ? "agents.notifications_delete" : "products.notifications_delete"} 
                              fallback={null}
                            >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteNotification(notification.id)}
                              disabled={deleteNotificationMutation.isPending || !canDeleteNotifications}
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
      <CreateNotificationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        product={product}
        onNotificationCreated={handleNotificationCreated}
        isAgent={isAgent}
      />
    </Dialog>
  );
};

export default NotificationsDialog;