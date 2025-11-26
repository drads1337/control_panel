import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import CreateUserDialog from './create-user-dialog';
import EditUserDialog from './edit-user-dialog';
import NotificationDialog from './notification-dialog';
import { TopupBalanceDialog } from './topup-balance-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';
import { Plus, RefreshCw, Users, Edit, Trash2, Bell, MoreVertical, Mail, Calendar, Shield } from 'lucide-react';
import { isAdmin, isOwner } from '@/lib/rbac-utils';
import type { User } from '@/entities/user';
import { handleError } from '@/lib/error-handler';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Hook to detect screen size
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

// Desktop Row Component
const UserItem = React.memo(({
  user,
  loading,
  onDelete,
  onEdit,
  onTopup,
  getStatusBadge,
  canEdit,
  canDelete,
}: {
  user: User;
  loading: boolean;
  onDelete: (userId: number) => void;
  onEdit: (userId: number) => void;
  onTopup: (userId: number) => void;
  getStatusBadge: (user: User) => React.ReactElement | null;
  canEdit: boolean;
  canDelete: boolean;
}) => {
  const isProtected = React.useMemo(() => {
    const rbacRoles = user.rbac_roles || [];
    if (rbacRoles.length === 0) return false;
    const roleNames = rbacRoles
      .map(r => (typeof r === 'string' ? r : r?.name || ''))
      .map(name => name.toLowerCase());
    return roleNames.includes('owner') || roleNames.includes('admin') || roleNames.includes('administrator');
  }, [user]);

  return (
    <div className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-9 w-9">
          <AvatarImage src={getAvatarUrl(user.avatar)} />
          <AvatarFallback className="text-xs">
            {user.first_name?.[0]}{user.last_name?.[0] || user.username?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm truncate">
              {user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.username
              }
            </h4>
            {getStatusBadge(user)}
            {user.rbac_roles && user.rbac_roles.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {user.rbac_roles.map(r => typeof r === 'string' ? r : r.name).join(', ')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground truncate">
              {user.email || `@${user.username}`}
            </p>
            {!isProtected && (
              <>
                {user.expires_at ? (
                  <span className="text-xs text-muted-foreground">
                    • Expires {new Date(user.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    • Unlimited access
                  </span>
                )}
                <span className="text-xs text-muted-foreground">• {user.token_balance ?? 0} tokens</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {isProtected ? (
          <span className="text-xs text-muted-foreground px-2">Protected</span>
        ) : (
          <>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(user.id)}
                disabled={loading}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => onTopup(user.id)}
                disabled={loading}
                title="Top up balance"
              >
                Balance
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(user.id)}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
UserItem.displayName = 'UserItem';

// Mobile Card Component
const MobileUserCard = React.memo(({
  user,
  loading,
  onDelete,
  onEdit,
  onTopup,
  getStatusBadge,
  canEdit,
  canDelete,
}: {
  user: User;
  loading: boolean;
  onDelete: (userId: number) => void;
  onEdit: (userId: number) => void;
  onTopup: (userId: number) => void;
  getStatusBadge: (user: User) => React.ReactElement | null;
  canEdit: boolean;
  canDelete: boolean;
}) => {
  const isProtected = React.useMemo(() => {
    const rbacRoles = user.rbac_roles || [];
    if (rbacRoles.length === 0) return false;
    const roleNames = rbacRoles
      .map(r => (typeof r === 'string' ? r : r?.name || ''))
      .map(name => name.toLowerCase());
    return roleNames.includes('owner') || roleNames.includes('admin') || roleNames.includes('administrator');
  }, [user]);

  return (
    <div className="p-3 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={getAvatarUrl(user.avatar)} />
            <AvatarFallback className="text-xs">
              {user.first_name?.[0]}{user.last_name?.[0] || user.username?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <h4 className="font-medium text-sm truncate">
                {user.first_name && user.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user.username
                }
              </h4>
              {getStatusBadge(user)}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
              <span className="truncate">{user.email || `@${user.username}`}</span>
              {!isProtected && user.rbac_roles && user.rbac_roles.length > 0 && (
                <>
                  <span>•</span>
                  <span>{user.rbac_roles.map(r => typeof r === 'string' ? r : r.name).join(', ')}</span>
                </>
              )}
              {!isProtected && (
                <>
                  <span>•</span>
                  {user.expires_at ? (
                    <span>{new Date(user.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  ) : (
                    <span>Unlimited</span>
                  )}
                  <span>•</span>
                  <span>{user.token_balance ?? 0} tokens</span>
                </>
              )}
            </div>
          </div>
        </div>
        {!isProtected && (
          <div className="flex items-center gap-0.5 shrink-0">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(user.id)}
                disabled={loading}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onTopup(user.id)}
                disabled={loading}
                title="Top up balance"
              >
                Balance
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(user.id)}
                disabled={loading}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
        {isProtected && (
          <span className="text-xs text-muted-foreground shrink-0">Protected</span>
        )}
      </div>
    </div>
  );
});
MobileUserCard.displayName = 'MobileUserCard';

interface EmployeesListProps {
  users: User[];
  loading: boolean;
  onDelete: (userId: number) => void;
  onEdit: (userId: number) => void;
  onTopup: (userId: number) => void;
  getStatusBadge: (user: User) => React.ReactElement | null;
  canEdit: boolean;
  canDelete: boolean;
  isMobile: boolean;
}

const EmployeesList: React.FC<EmployeesListProps> = ({
  users,
  loading,
  onDelete,
  onEdit,
  onTopup,
  getStatusBadge,
  canEdit,
  canDelete,
  isMobile
}) => {

  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = users.length > 30;

  // Adjusted height for mobile cards vs desktop rows
  const itemHeight = isMobile ? 70 : 65;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? users.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  // Update measurements when view changes
  useEffect(() => {
    rowVirtualizer.measure();
  }, [isMobile, rowVirtualizer]);

  const renderItem = (user: User, index: number, style?: React.CSSProperties) => {
    if (isMobile) {
      return (
        <div key={user.id} style={style}>
          <MobileUserCard
            user={user}
            loading={loading}
            onDelete={onDelete}
            onEdit={onEdit}
            onTopup={onTopup}
            getStatusBadge={getStatusBadge}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      );
    }

    return (
      <div key={user.id} data-index={index} style={style}>
        <UserItem
          user={user}
          loading={loading}
          onDelete={onDelete}
          onEdit={onEdit}
          onTopup={onTopup}
          getStatusBadge={getStatusBadge}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>
    );
  };

  if (shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px', contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <div className={isMobile ? "p-1" : ""}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const user = users[virtualRow.index];
              return renderItem(user, virtualRow.index, {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              });
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isMobile ? "flex flex-col gap-1" : ""}>
      {users.map((user, index) => renderItem(user, index))}
    </div>
  );
};

interface EmployeesTabProps {
  fetchUsersWithTracking: (params?: {
    roles?: string[];
    page?: number;
    per_page?: number;
    search?: string;
    role?: string;
    project_id?: number;
  }) => Promise<void>;
  currentPage: number;
  perPage: number;
  users: User[];
  loading: boolean;
  error: string | null;
  total: number;
  deleteExistingUser: (userId: number) => Promise<void>;
  employeeRolesFilter?: string[];
}

const EmployeesTab: React.FC<EmployeesTabProps> = ({
  fetchUsersWithTracking,
  currentPage,
  perPage,
  users,
  loading,
  error,
  total,
  deleteExistingUser,
  employeeRolesFilter = ['admin', 'seller', 'developer', 'moderator']
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const activeRolesFilter = employeeRolesFilter || ['admin', 'seller', 'developer', 'moderator'];

  const { hasPermission } = usePermissions();
  const canCreateUsers = hasPermission('employees.create');
  const canEditUsers = hasPermission('employees.edit');
  const canDeleteUsers = hasPermission('employees.delete');

  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);
  const [isTopupDialogOpen, setIsTopupDialogOpen] = useState(false);
  const [selectedUserIdForTopup, setSelectedUserIdForTopup] = useState<number | null>(null);
  const [selectedUserNameForTopup, setSelectedUserNameForTopup] = useState<string>('');
  const [selectedUserBalanceForTopup, setSelectedUserBalanceForTopup] = useState<number>(0);

  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'error',
    targetUsers: [] as number[],
    sendToAll: false,
    repeatCount: 1
  });

  const getStatusBadge = useCallback((user: User) => {
    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return <span className="text-xs text-muted-foreground bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-1.5 py-0.5 rounded">Expired</span>
    }
    return null;
  }, [])


  const handleDeleteUser = useCallback(async (userId: number) => {
    const userToDelete = users.find(u => u.id === userId)

    if (userToDelete && (isAdmin(userToDelete) || isOwner(userToDelete))) {
      toast.error('Cannot delete admin or owner users')
      return
    }

    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteExistingUser(userId)
        toast.success('User deleted successfully')
        await fetchUsersWithTracking({
          roles: activeRolesFilter
        });
      } catch (error) {
        await handleError(error, {
          category: 'client',
          userMessage: 'Failed to delete user',
          metadata: { userId, action: 'delete_user' }
        })
      }
    }
  }, [users, deleteExistingUser, fetchUsersWithTracking, activeRolesFilter])

  const handleEditUser = useCallback((userId: number) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUserForEdit(user);
      setIsEditUserDialogOpen(true);
    }
  }, [users]);


  const handleTopupBalance = useCallback((userId: number) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUserIdForTopup(userId);
      setSelectedUserNameForTopup(
        user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.username || `User ${userId}`
      );
      setSelectedUserBalanceForTopup(user.token_balance || 0);
      setIsTopupDialogOpen(true);
    }
  }, [users]);

  const handleSendNotification = useCallback(async () => {
    let targetUserIds: number[] = []

    try {
      if (!notificationForm.title || !notificationForm.message) {
        toast.error('Title and message are required')
        return
      }

      if (!notificationForm.sendToAll && notificationForm.targetUsers.length === 0) {
        toast.error('Please select at least one user or choose "Send to all"')
        return
      }

      if (!notificationForm.repeatCount || notificationForm.repeatCount < 1 || notificationForm.repeatCount > 10) {
        toast.error('Repeat count must be between 1 and 10')
        return
      }

      if (notificationForm.sendToAll) {
        targetUserIds = users
          .filter(u => !isAdmin(u) && !isOwner(u))
          .map(u => u.id)

        if (targetUserIds.length === 0) {
          toast.error('No workers found to send notifications to. Admin and owner users are excluded.')
          return
        }
      } else {
        targetUserIds = notificationForm.targetUsers.filter(userId => {
          const user = users.find(u => u.id === userId)
          return user && !isAdmin(user) && !isOwner(user)
        })

        if (targetUserIds.length === 0) {
          toast.error('Selected users include only admin/owner. Admin and owner users cannot receive notifications.')
          return
        }
      }

      const notificationData = {
        title: notificationForm.title,
        message: notificationForm.message,
        type: notificationForm.type,
        target_users: targetUserIds,
        repeat_count: notificationForm.repeatCount
      }

      const { getApiUrl } = await import('@/shared/api');
      const response = await fetch(getApiUrl('/api/notifications/send'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send notification')
      }

      const result = await response.json()

      setNotificationForm({
        title: '',
        message: '',
        type: 'info',
        targetUsers: [],
        sendToAll: false,
        repeatCount: 1
      })
      setIsNotificationDialogOpen(false)

      toast.success(`Notification sent successfully to ${result.notifications_created} workers`)
    } catch (error) {
      await handleError(error, {
        category: 'client',
        userMessage: 'Failed to send notification',
        metadata: { action: 'send_notification', targetUsers: targetUserIds.length }
      })
    }
  }, [notificationForm, users])

  return (
    <div className="space-y-4">
      <Card className={cn(isMobile && "border-0 shadow-none bg-transparent")}>
        <CardHeader className={cn(isMobile && "px-0 pt-0")}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Employees</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {total || 0} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchUsersWithTracking({ roles: activeRolesFilter })}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
              <ConditionalRender permission="employees.create" fallback={null}>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsCreateUserDialogOpen(true)}
                  disabled={loading}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add
                </Button>
              </ConditionalRender>
              <ConditionalRender permission="employees.send_notification" fallback={null}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsNotificationDialogOpen(true)}
                  disabled={loading || users.length === 0}
                >
                  <Bell className="h-4 w-4" />
                </Button>
              </ConditionalRender>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn("pt-0", !isMobile && "-mt-3", isMobile && "px-0")}>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner message="Loading employees..." />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500 text-sm text-center px-4">Error: {error}</div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">No employees found</div>
              </div>
            </div>
          ) : (
            <EmployeesList
              users={users}
              loading={loading}
              onDelete={handleDeleteUser}
              onEdit={handleEditUser}
              onTopup={handleTopupBalance}
              getStatusBadge={getStatusBadge}
              canEdit={canEditUsers}
              canDelete={canDeleteUsers}
              isMobile={isMobile}
            />
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={isCreateUserDialogOpen}
        onOpenChange={setIsCreateUserDialogOpen}
        onSuccess={() => {
          fetchUsersWithTracking({
            page: currentPage,
            per_page: perPage
          });
        }}
      />

      <EditUserDialog
        open={isEditUserDialogOpen}
        onOpenChange={setIsEditUserDialogOpen}
        user={selectedUserForEdit}
        onSuccess={() => {
          setSelectedUserForEdit(null);
          fetchUsersWithTracking({
            page: currentPage,
            per_page: perPage
          });
        }}
      />

      <NotificationDialog
        open={isNotificationDialogOpen}
        onOpenChange={setIsNotificationDialogOpen}
        onSend={handleSendNotification}
        loading={loading}
        form={notificationForm}
        onFormChange={setNotificationForm}
        users={users}
      />

      {selectedUserIdForTopup && (
        <TopupBalanceDialog
          open={isTopupDialogOpen}
          onOpenChange={setIsTopupDialogOpen}
          userId={selectedUserIdForTopup}
          userName={selectedUserNameForTopup}
          currentBalance={selectedUserBalanceForTopup}
          onSuccess={() => {
            fetchUsersWithTracking({
              roles: activeRolesFilter
            });
          }}
        />
      )}
    </div>
  );
};

export default EmployeesTab;