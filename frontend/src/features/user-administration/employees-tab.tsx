import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils';
import { ConditionalRender } from '@/lib/rbac/conditional-render';
import CreateUserDialog from './create-user-dialog';
import EditUserDialog from './edit-user-dialog';
import NotificationDialog from './notification-dialog';
import { TopupBalanceDialog } from './topup-balance-dialog';
import { usePermissions } from '@/lib/hooks';
import { toast } from 'sonner';
import { Plus, RefreshCw, Users, Edit, Trash2, Bell, MoreVertical, Mail, Calendar, Shield, Wallet } from 'lucide-react';
import { isAdmin, isOwner } from '@/lib/rbac';
import type { User } from '@/entities/user';
import { handleError } from '@/lib/error-handler';
import { enhancedApi } from '@/lib/api/enhanced-client';
import { getUsers } from '@/entities/user';
import { useAuthContext } from '@/app/providers/auth-provider';
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
                size="icon"
                className="h-8 w-8"
                onClick={() => onTopup(user.id)}
                disabled={loading}
                title="Top up balance"
              >
                <Wallet className="h-4 w-4" />
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
                size="icon"
                className="h-7 w-7"
                onClick={() => onTopup(user.id)}
                disabled={loading}
                title="Top up balance"
              >
                <Wallet className="h-3.5 w-3.5" />
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
  const { user: currentUser } = useAuthContext()
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

  // Clean up invalid user IDs when users list changes or dialog opens
  useEffect(() => {
    if (notificationForm.targetUsers.length > 0 && users.length > 0) {
      // Create a set of valid user IDs from current users list
      const validUserIds = new Set(
        users.map(u => {
          const userId = typeof u.id === 'string' ? parseInt(u.id, 10) : u.id
          return !isNaN(userId) && userId > 0 ? userId : null
        }).filter((id): id is number => id !== null)
      )
      
      // Filter out invalid user IDs
      const validSelectedIds = notificationForm.targetUsers.filter(id => {
        const normalizedId = typeof id === 'string' ? parseInt(id, 10) : id
        return !isNaN(normalizedId) && normalizedId > 0 && validUserIds.has(normalizedId)
      })
      
      // Update form if some IDs were removed
      if (validSelectedIds.length !== notificationForm.targetUsers.length) {
        setNotificationForm(prev => ({
          ...prev,
          targetUsers: validSelectedIds
        }))
      }
    }
  }, [users, notificationForm.targetUsers])

  // Clean up invalid user IDs when notification dialog opens
  const handleNotificationDialogOpenChange = useCallback((open: boolean) => {
    setIsNotificationDialogOpen(open)
    
    if (open && users.length > 0 && notificationForm.targetUsers.length > 0) {
      // Validate and clean up user IDs when dialog opens
      const validUserIds = new Set(
        users.map(u => {
          const userId = typeof u.id === 'string' ? parseInt(u.id, 10) : u.id
          return !isNaN(userId) && userId > 0 ? userId : null
        }).filter((id): id is number => id !== null)
      )
      
      const validSelectedIds = notificationForm.targetUsers.filter(id => {
        const normalizedId = typeof id === 'string' ? parseInt(id, 10) : id
        return !isNaN(normalizedId) && normalizedId > 0 && validUserIds.has(normalizedId)
      })
      
      if (validSelectedIds.length !== notificationForm.targetUsers.length) {
        setNotificationForm(prev => ({
          ...prev,
          targetUsers: validSelectedIds
        }))
      }
    }
  }, [users, notificationForm.targetUsers])


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
      } catch (error: any) {
        // Check if this is an authentication error (401)
        const isAuthError = error?.response?.status === 401 || error?.isAuthError
        const category = isAuthError ? 'authentication' : 'client'
        
        // Global error handler will handle authentication errors and redirect to login
        // We just need to show appropriate error message
        await handleError(error, {
          category,
          userMessage: isAuthError ? 'Your session has expired. Please log in again.' : 'Failed to delete user',
          metadata: { userId, action: 'delete_user' },
          skipToast: isAuthError // Don't show toast for auth errors - redirect will happen
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
    let finalTargetUserIds: number[] = []
    let userMap: Map<number, User> | null = null

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

      // Fetch all users in the project (without role filtering) to ensure we have valid IDs
      // The backend validates against all project users, not just those with specific roles
      // Fetch all pages if needed to get complete user list
      let allUsers: User[] = []
      let currentPage = 1
      let hasMorePages = true
      const perPage = 1000 // Fetch in chunks to avoid timeout
      
      while (hasMorePages) {
        const response = await getUsers({
          per_page: perPage,
          page: currentPage
          // Don't pass roles parameter - we need all project users for validation
      })
      
        const pageUsers = response.users || []
        allUsers = [...allUsers, ...pageUsers]
        
        // Check if there are more pages
        const totalFetched = allUsers.length
        const totalAvailable = response.total || 0
        
        if (totalAvailable <= totalFetched || pageUsers.length < perPage) {
          hasMorePages = false
        } else {
          currentPage++
        }
      }
      
      // Log if we got fewer users than expected
      if (allUsers.length === 0) {
        console.warn('No users fetched for validation. This might indicate a problem.')
      }
      
      // Create a map of normalized user IDs to user objects for fast lookup
      // Also validate that all users belong to the current project
      userMap = new Map<number, User>()
      const currentProjectId = currentUser?.project_id
      const wrongProjectUserIds: number[] = []
      
      for (const u of allUsers) {
        const userId = typeof u.id === 'string' ? parseInt(u.id, 10) : u.id
        if (!isNaN(userId) && userId > 0) {
          // Strict project_id validation: enforce project isolation
          // If current user has a project_id, only include users with the same project_id (not null/undefined)
          // If current user has no project_id, only include users with no project_id
          if (currentProjectId !== null && currentProjectId !== undefined) {
            // Current user has a project_id - only include users with matching project_id
            if (u.project_id === null || u.project_id === undefined || u.project_id !== currentProjectId) {
              wrongProjectUserIds.push(userId)
              console.warn(`User ID ${userId} has project_id ${u.project_id}, but current project is ${currentProjectId}. Excluding from userMap.`)
              continue // Skip users from different projects or with null project_id
            }
          } else {
            // Current user has no project_id - only include users with no project_id
            if (u.project_id !== null && u.project_id !== undefined) {
              wrongProjectUserIds.push(userId)
              console.warn(`User ID ${userId} has project_id ${u.project_id}, but current user has no project. Excluding from userMap.`)
              continue // Skip users with project_id when current user has none
            }
          }
          userMap.set(userId, u)
        }
      }
      
      // Warn if we found users from different projects
      if (wrongProjectUserIds.length > 0) {
        console.warn(`Found ${wrongProjectUserIds.length} user(s) from different projects. These were excluded:`, wrongProjectUserIds)
      }
      
      // Ensure userMap was created successfully
      if (!userMap || userMap.size === 0) {
        console.error('Failed to create user map or no users found')
        toast.error('Failed to load user list. Please refresh and try again.')
        return
      }
      
      // Normalize selected user IDs to numbers - be more strict about validation
      const normalizedSelectedIds = notificationForm.targetUsers
        .map(id => {
          // Handle both string and number IDs
          if (typeof id === 'string') {
            const parsed = parseInt(id, 10)
            return isNaN(parsed) ? null : parsed
          }
          if (typeof id === 'number') {
            return isNaN(id) || id <= 0 ? null : id
          }
          return null
        })
        .filter((id): id is number => id !== null && id > 0)
      
      // Early validation: if no valid normalized IDs, stop here
      if (normalizedSelectedIds.length === 0 && notificationForm.targetUsers.length > 0) {
        toast.error('Selected user IDs are invalid. Please select users again.')
        return
      }
      
      if (notificationForm.sendToAll) {
        // Get all non-admin/owner users from the fetched list, excluding current user
        targetUserIds = Array.from(userMap!.values())
          .filter(u => {
            const isAdminOrOwner = isAdmin(u) || isOwner(u);
            // Normalize IDs for comparison (handle both string and number)
            const userId = typeof u.id === 'string' ? parseInt(u.id, 10) : u.id;
            const currentUserId = currentUser?.id ? (typeof currentUser.id === 'string' ? parseInt(currentUser.id, 10) : currentUser.id) : null;
            const isCurrentUser = currentUserId && userId === currentUserId;
            return !isAdminOrOwner && !isCurrentUser;
          })
          .map(u => {
            const userId = typeof u.id === 'string' ? parseInt(u.id, 10) : u.id
            return userId
          })
          .filter((id): id is number => !isNaN(id) && id > 0)

        if (targetUserIds.length === 0) {
          toast.error('No workers found to send notifications to. Admin and owner users are excluded.')
          return
        }
      } else {
        // Validate selected user IDs against fetched users
        const invalidUserIds: number[] = []
        const adminOwnerUserIds: number[] = []
        
        targetUserIds = normalizedSelectedIds
          .filter(userId => {
            // Check if user exists in the map
            const user = userMap!.get(userId)
            
            if (!user) {
              invalidUserIds.push(userId)
              console.warn(`User ID ${userId} not found in project users`)
              return false
            }
            
            // Exclude admin/owner users
            if (isAdmin(user) || isOwner(user)) {
              adminOwnerUserIds.push(userId)
              return false
            }
            
            // Exclude current user (normalize IDs for comparison)
            if (currentUser?.id) {
              const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
              const currentUserId = typeof currentUser.id === 'string' ? parseInt(currentUser.id, 10) : currentUser.id;
              if (userId === currentUserId) {
                return false
              }
            }
            
            return true
          })

        if (targetUserIds.length === 0) {
          let errorMsg = 'Selected users cannot receive notifications. '
          if (invalidUserIds.length > 0) {
            errorMsg += `${invalidUserIds.length} user(s) not found or invalid. `
          }
          if (adminOwnerUserIds.length > 0) {
            errorMsg += `${adminOwnerUserIds.length} user(s) are admin/owner and excluded.`
          }
          toast.error(errorMsg.trim())
          return
        }
        
        // Warn if some selected users were filtered out
        if (targetUserIds.length < notificationForm.targetUsers.length) {
          const filteredCount = notificationForm.targetUsers.length - targetUserIds.length
          let warningMsg = `${filteredCount} selected user(s) were filtered out. `
          if (invalidUserIds.length > 0) {
            warningMsg += `${invalidUserIds.length} user(s) not found. `
          }
          if (adminOwnerUserIds.length > 0) {
            warningMsg += `${adminOwnerUserIds.length} admin/owner user(s) excluded.`
          }
          toast.warning(warningMsg.trim())
        }
      }

      // Final validation - ensure all IDs are valid numbers and exist in the user map
      // This is a critical safety check - we must never send IDs that aren't in the userMap
      finalTargetUserIds = targetUserIds
        .map(id => {
          // Normalize ID to number
          if (typeof id === 'string') {
            const parsed = parseInt(id, 10)
            return isNaN(parsed) ? null : parsed
          }
          if (typeof id === 'number') {
            return isNaN(id) || id <= 0 ? null : id
          }
          return null
        })
        .filter((id): id is number => {
          if (id === null || id <= 0) {
            console.error(`Filtered out invalid/null user ID: ${id}`)
            return false
          }
          // Final check: user must exist in the map
          if (!userMap!.has(id)) {
            console.error(`Filtered out invalid user ID before sending: ${id} (not in user map)`)
            console.error(`User map size: ${userMap!.size}, Available user IDs in map: ${Array.from(userMap!.keys()).slice(0, 20).join(', ')}...`)
            return false
          }
          return true
        })

      // Critical safety check: Never proceed if we have no valid user IDs
      if (finalTargetUserIds.length === 0) {
        if (notificationForm.targetUsers.length > 0) {
          toast.error('Selected user IDs are invalid or do not belong to this project. Please refresh the user list and try again.')
        } else {
          toast.error('No valid users selected. Please select users and try again.')
        }
        return
      }

      // Additional safety check: Verify all IDs are still in the userMap (defensive programming)
      const invalidIds = finalTargetUserIds.filter(id => !userMap!.has(id))
      if (invalidIds.length > 0) {
        console.error('CRITICAL: Found invalid user IDs after validation:', invalidIds)
        console.error('This should never happen. Available user IDs:', Array.from(userMap!.keys()).slice(0, 20))
        toast.error(`Validation error: ${invalidIds.length} user ID(s) are invalid. Please refresh and try again.`)
        return
      }
      
      const notificationData = {
        title: notificationForm.title,
        message: notificationForm.message,
        type: notificationForm.type,
        target_users: finalTargetUserIds,
        repeat_count: notificationForm.repeatCount
      }

      const result = await enhancedApi.post('/api/notifications/send', notificationData).then(res => res.data)

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
    } catch (error: any) {
      // Parse backend error message for better user feedback
      let errorMessage = 'Failed to send notification'
      const backendError = error?.response?.data?.error
      
      if (backendError) {
        // Check if error mentions specific user IDs
        if (backendError.includes('User IDs') && backendError.includes('not found')) {
          // Extract user IDs from error message if possible
          const userIdMatch = backendError.match(/\[([^\]]+)\]/)
          const failedUserIds = userIdMatch ? userIdMatch[1] : 'unknown'
          errorMessage = `Cannot send notification: User ID(s) ${failedUserIds} not found or do not belong to this project. Please refresh the user list and try again.`
        } else if (backendError.includes('not found or do not belong')) {
          errorMessage = backendError + ' The selected users may have been removed or moved to a different project. Please refresh and try again.'
        } else {
          errorMessage = backendError
        }
      }
      
      console.error('Notification send error:', {
        error,
        targetUserIds: finalTargetUserIds.length > 0 ? finalTargetUserIds : targetUserIds,
        selectedUserIds: notificationForm.targetUsers,
        backendError
      })
      
      toast.error(errorMessage)
      
      await handleError(error, {
        category: 'client',
        userMessage: errorMessage,
        metadata: { 
          action: 'send_notification', 
          targetUsers: finalTargetUserIds.length > 0 ? finalTargetUserIds.length : targetUserIds.length,
          selectedUserIds: notificationForm.targetUsers,
          failedUserIds: finalTargetUserIds.length > 0 ? finalTargetUserIds : targetUserIds
        }
      })
    }
  }, [notificationForm, users, employeeRolesFilter, total, currentUser])

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
        onOpenChange={handleNotificationDialogOpenChange}
        onSend={handleSendNotification}
        loading={loading}
        form={notificationForm}
        onFormChange={setNotificationForm}
        users={users}
        currentUserId={currentUser?.id}
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