import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Plus, Trash2, Clock, Eye, EyeOff } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { getGameNotifications, deleteNotification } from '@/entities/notification';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import CreateNotificationDialog from './CreateNotificationDialog';
import type { Game } from '@/entities/game';
import type { GameNotification } from '@/entities/notification';

interface NotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game | null;
}

// Cache keys for notifications
const notificationKeys = {
  all: ['notifications'] as const,
  game: (gameId: number) => [...notificationKeys.all, 'game', gameId] as const,
}

const NotificationsDialog: React.FC<NotificationsDialogProps> = ({
  open,
  onOpenChange,
  game,
}) => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  
  const canViewNotifications = hasPermission('games.notifications_view');
  const canCreateNotifications = hasPermission('games.notifications_create');
  const canDeleteNotifications = hasPermission('games.notifications_delete');
  
  // Early return if user doesn't have permission to view notifications
  if (!canViewNotifications) {
    return null;
  }
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Load notifications using React Query
  const { data: notificationsData, isLoading: loading } = useQuery({
    queryKey: notificationKeys.game(game?.id || 0),
    queryFn: async () => {
      if (!game) throw new Error('Game is required');
      return await getGameNotifications(game.id);
    },
    enabled: open && !!game && canViewNotifications,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403 || error?.response?.status === 429) {
        return false;
      }
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
  });

  const notifications = notificationsData?.notifications || [];

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      // Invalidate and refetch notifications
      if (game) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.game(game.id) });
      }
      toast.success('Notification deleted');
    },
    onError: (error: any) => {
      console.error('Error deleting notification:', error);
      toast.error('Error deleting notification');
    },
  });

  // Virtualization setup - only enable if we have many notifications
  // Always call useVirtualizer with consistent parameters to avoid hook order issues
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = notifications.length > 30; // Only virtualize if more than 30 items
  
  const rowVirtualizer = useVirtualizer({
    count: notifications.length, // Always use actual count, not conditional
    getScrollElement: () => parentRef.current,
    estimateSize: () => 128, // Estimated notification card height in pixels (including gap)
    overscan: 3, // Render 3 extra items outside visible area
    enabled: true, // Always enabled - we control rendering via shouldVirtualize in JSX
  });

  // All hooks must be called before any early returns
  const handleDeleteNotification = useCallback(async (notificationId: number) => {
    if (!canDeleteNotifications) {
      toast.error('You do not have permission to delete notifications');
      return;
    }
    
    deleteNotificationMutation.mutate(notificationId);
  }, [canDeleteNotifications, deleteNotificationMutation]);

  const handleNotificationCreated = useCallback(() => {
    // Invalidate and refetch notifications when a new one is created
    if (game) {
      queryClient.invalidateQueries({ queryKey: notificationKeys.game(game.id) });
    }
  }, [game, queryClient]);

  if (!game) {
    return null;
  }

  if (!canViewNotifications) {
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
        default: return type; // For custom types
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
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            Manage Notifications
          </DialogTitle>
          <DialogDescription className="text-sm">
            Make necessary changes to the settings for the game "{game.name}".
          </DialogDescription>
        </DialogHeader>
        
        {/* Header and create button immediately after the description */}
        <div className="flex items-center justify-between mb-1 px-1">
          <h3 className="text-base font-semibold">Notifications ({notifications.length})</h3>
          <ConditionalRender permission="games.notifications_create" fallback={null}>
          <Button 
            onClick={() => setShowCreateDialog(true)} 
            size="sm"
            className="h-8"
            disabled={!canCreateNotifications}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
          </ConditionalRender>
        </div>
        
        <div className="space-y-4 overflow-y-auto max-h-[calc(80vh-120px)] pr-2">
          {/* Existing notifications */}
          <Card className="border">
            <CardContent className="p-4">
              
              {loading ? (
                <Spinner message="Loading notifications..." />
              ) : notifications.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications found</p>
                  <p className="text-xs">Create the first notification for this game.</p>
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
                                    {notification.show_count >= notification.repeat_count && (
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
                                    <span className="flex items-center gap-1">
                                      <span>Views:</span>
                                      <span className={`font-medium ${
                                        notification.show_count >= notification.repeat_count 
                                          ? 'text-green-600' 
                                          : 'text-orange-600'
                                      }`}>
                                        {notification.show_count}/{notification.repeat_count}
                                      </span>
                                    </span>
                                    {notification.user_count && notification.user_count > 1 && (
                                      <span className="flex items-center gap-1">
                                        <span>Users:</span>
                                        <span className="font-medium text-blue-600">
                                          {notification.user_count}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ConditionalRender permission="games.notifications_delete" fallback={null}>
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
                                {notification.show_count >= notification.repeat_count && (
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
                                <span className="flex items-center gap-1">
                                  <span>Views:</span>
                                  <span className={`font-medium ${
                                    notification.show_count >= notification.repeat_count 
                                      ? 'text-green-600' 
                                      : 'text-orange-600'
                                  }`}>
                                    {notification.show_count}/{notification.repeat_count}
                                  </span>
                                </span>
                                {notification.user_count && notification.user_count > 1 && (
                                  <span className="flex items-center gap-1">
                                    <span>Users:</span>
                                    <span className="font-medium text-blue-600">
                                      {notification.user_count}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <ConditionalRender permission="games.notifications_delete" fallback={null}>
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
            </CardContent>
          </Card>
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

      {/* Dialog for creating a new notification */}
      <CreateNotificationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        game={game}
        onNotificationCreated={handleNotificationCreated}
      />
    </Dialog>
  );
};

export default NotificationsDialog;