import React, { useState, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import CreateUserDialog from './create-user-dialog';
import EditUserDialog from './edit-user-dialog';
import NotificationDialog from './notification-dialog';
import UserTokensDialog from './user-tokens-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';
import { Plus, RefreshCw, Users, Edit, Trash2, Bell, Key } from 'lucide-react';
import { isAdmin, isOwner } from '@/lib/rbac-utils';
import type { User } from '@/entities/user';
import { handleError } from '@/lib/error-handler';

const UserItem = React.memo(({ 
  user, 
  loading, 
  onDelete,
  onEdit,
  onTokens,
  getStatusBadge,
  getRoleBadge,
  canEdit,
  canDelete,
  employeeRolesFilter
}: { 
  user: User;
  loading: boolean;
  onDelete: (userId: number) => void;
  onEdit: (userId: number) => void;
  onTokens: (userId: number) => void;
  getStatusBadge: (user: User) => React.ReactElement | null;
  getRoleBadge: (user: User, employeeRolesFilter?: string[]) => React.ReactElement;
  canEdit: boolean;
  canDelete: boolean;
  employeeRolesFilter?: string[];
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
          <AvatarImage src={user.avatar || undefined} />
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
            {getRoleBadge(user, employeeRolesFilter)}
            {getStatusBadge(user)}
            {!isProtected && (
              <span className="text-xs text-muted-foreground">• {user.token_balance ?? 0} tokens</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground truncate">
            {user.email || `@${user.username}`}
          </p>
            {user.expires_at ? (
              <span className="text-xs text-muted-foreground">
                • Until {new Date(user.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                • Unlimited
              </span>
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
                size="icon"
                className="h-8 w-8"
                onClick={() => onTokens(user.id)}
                disabled={loading}
              >
                <Key className="h-4 w-4" />
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

interface EmployeesListProps {
  users: User[];
  loading: boolean;
  onDelete: (userId: number) => void;
  onEdit: (userId: number) => void;
  onTokens: (userId: number) => void;
  getStatusBadge: (user: User) => React.ReactElement | null;
  getRoleBadge: (user: User, employeeRolesFilter?: string[]) => React.ReactElement;
  canEdit: boolean;
  canDelete: boolean;
  employeeRolesFilter?: string[];
}

const EmployeesList: React.FC<EmployeesListProps> = ({
  users,
  loading,
  onDelete,
  onEdit,
  onTokens,
  getStatusBadge,
  getRoleBadge,
  canEdit,
  canDelete,
  employeeRolesFilter
}) => {

  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = users.length > 50;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? users.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
    enabled: shouldVirtualize,
  });

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
          <div className="divide-y">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const user = users[virtualRow.index];
              return (
                <div
                  key={user.id}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <UserItem
                    user={user}
                    loading={loading}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onTokens={onTokens}
                    getStatusBadge={getStatusBadge}
                    getRoleBadge={getRoleBadge}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    employeeRolesFilter={employeeRolesFilter}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {users.map((user) => (
        <UserItem
          key={user.id}
          user={user}
          loading={loading}
          onDelete={onDelete}
          onEdit={onEdit}
          onTokens={onTokens}
          getStatusBadge={getStatusBadge}
          getRoleBadge={getRoleBadge}
          canEdit={canEdit}
          canDelete={canDelete}
          employeeRolesFilter={employeeRolesFilter}
        />
      ))}
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

  const activeRolesFilter = employeeRolesFilter || ['admin', 'seller', 'developer', 'moderator'];

  const { hasPermission } = usePermissions();
  const canCreateUsers = hasPermission('employees.create');
  const canEditUsers = hasPermission('employees.edit');
  const canDeleteUsers = hasPermission('employees.delete');

  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);
  const [isTokensDialogOpen, setIsTokensDialogOpen] = useState(false);
  const [selectedUserIdForTokens, setSelectedUserIdForTokens] = useState<number | null>(null);
  const [selectedUserNameForTokens, setSelectedUserNameForTokens] = useState<string>('');

  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'error',
    targetUsers: [] as number[],
    sendToAll: false,
    repeatCount: 1
  });

  const getRoleDisplayName = useCallback((role: string) => {
    const roleNames: Record<string, string> = {
      'admin': 'Administrator',
      'developer': 'Developer',
      'seller': 'Seller',
      'user': 'Employee',
      'custom': 'Custom Role',
    }
    return roleNames[role] || role
  }, [])

  const getStatusBadge = useCallback((user: User) => {
    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return <span className="text-xs text-muted-foreground">Expired</span>
    }
    return null;
  }, [])

  const getRoleBadge = useCallback((user: User, employeeRolesFilter?: string[]) => {
    const rbacRoles = user.rbac_roles || [];
    let roleName = '';

    if (rbacRoles.length > 0) {
      const firstRole = rbacRoles[0];
      roleName = typeof firstRole === 'string' ? firstRole : (firstRole?.name || '');
    } else {
      const legacyRoles = user.roles || [];
      if (legacyRoles.length > 0) {
        roleName = legacyRoles[0];
      }
    }

    if (!roleName) {
      return <span className="text-xs text-muted-foreground">Employee</span>
    }

    const roleNameLower = roleName.toLowerCase();
    if (roleNameLower === 'owner') {
      return <span className="text-xs text-muted-foreground">Owner</span>
    }
    if (roleNameLower === 'admin' || roleNameLower === 'administrator') {
      return <span className="text-xs text-muted-foreground">Admin</span>
    }

    return <span className="text-xs text-muted-foreground">{getRoleDisplayName(roleName)}</span>
  }, [getRoleDisplayName])

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
  }, [users, deleteExistingUser, fetchUsersWithTracking])

  const handleEditUser = useCallback((userId: number) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUserForEdit(user);
      setIsEditUserDialogOpen(true);
    }
  }, [users]);

  const handleTokens = useCallback((userId: number) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUserIdForTokens(userId);
      setSelectedUserNameForTokens(
        user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}` 
          : user.username || `User ${userId}`
      );
      setIsTokensDialogOpen(true);
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
      <Card>
        <CardHeader className="pb-0">
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
                <RefreshCw className="h-4 w-4" />
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
        <CardContent className="pt-0 -mt-3">
          {loading ? (
            <Spinner message="Loading employees..." />
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500">Error: {error}</div>
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
              onTokens={handleTokens}
              getStatusBadge={getStatusBadge}
              getRoleBadge={getRoleBadge}
              canEdit={canEditUsers}
              canDelete={canDeleteUsers}
              employeeRolesFilter={activeRolesFilter}
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

      {selectedUserIdForTokens !== null && (
        <UserTokensDialog
          open={isTokensDialogOpen}
          onOpenChange={setIsTokensDialogOpen}
          userId={selectedUserIdForTokens}
          userName={selectedUserNameForTokens}
        />
      )}
    </div>
  );
};

export default EmployeesTab;
