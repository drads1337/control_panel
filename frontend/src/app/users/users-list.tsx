import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { getAvatarUrl } from '@/lib/utils';
import {
  MoreHorizontal, Edit, Trash2, UserCheck, Eye, EyeOff, 
  Shield, Key, RefreshCw, Ban, CheckCircle, Users
} from 'lucide-react';
import type { User } from '@/entities/user';

interface UsersListProps {
  users: User[];
  loading: boolean;
  selectedUsers: Set<number>;
  onSelectUser: (userId: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onUserAction: (action: string, userId: number) => void;
  onViewUser: (user: User) => void;
  canEdit: boolean;
  canDelete: boolean;
}

const UsersList: React.FC<UsersListProps> = ({
  users,
  loading,
  selectedUsers,
  onSelectUser,
  onSelectAll,
  onUserAction,
  onViewUser,
  canEdit,
  canDelete
}) => {
  const allSelected = users.length > 0 && users.every(user => selectedUsers.has(user.id));
  const someSelected = users.some(user => selectedUsers.has(user.id));

  const parentRef = useRef<HTMLDivElement>(null);
  // Lower threshold for better performance - virtualize when more than 30 items
  const shouldVirtualize = users.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? users.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground mb-4">
          <Users className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Users Found</h3>
          <p>No users match your current filters</p>
        </div>
      </div>
    );
  }

  const UserRow = React.memo<{
    user: User;
    isSelected: boolean;
    onSelectUser: (userId: number, selected: boolean) => void;
    onUserAction: (action: string, userId: number) => void;
    onViewUser: (user: User) => void;
    canEdit: boolean;
    canDelete: boolean;
    style?: React.CSSProperties;
  }>(({ user, isSelected, onSelectUser, onUserAction, onViewUser, canEdit, canDelete, style }) => (
    <TableRow style={style}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectUser(user.id, checked as boolean)}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={getAvatarUrl(user.avatar)} />
            <AvatarFallback>
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{user.username}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {user.roles?.[0] || 'user'}
          </Badge>
          {user.rbac_roles && user.rbac_roles.length > 0 && (
            <Badge variant="outline" className="text-xs">
              +{user.rbac_roles.length} RBAC
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          className={getStatusClasses('active' as StatusType)}
          variant="secondary"
        >
          {getStatusText('active' as StatusType)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {user.project_id ? `Project ${user.project_id}` : 'No project'}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm text-muted-foreground">
          {user.last_login 
            ? new Date(user.last_login).toLocaleDateString()
            : 'Never'
          }
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <div className="font-medium">{user.active_keys || 0} active</div>
          <div className="text-muted-foreground">{user.keys_count || 0} total</div>
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewUser(user)}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => onUserAction('edit', user.id)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onUserAction('roles', user.id)}>
              <Shield className="h-4 w-4 mr-2" />
              Manage Roles
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUserAction('keys', user.id)}>
              <Key className="h-4 w-4 mr-2" />
              View Keys
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onUserAction('deactivate', user.id)}>
              <Ban className="h-4 w-4 mr-2" />
              Deactivate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUserAction('reset', user.id)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Password
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onUserAction('delete', user.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  ));

  UserRow.displayName = 'UserRow';

  const renderUserRowCells = (user: User) => (
    <>
      <TableCell>
        <Checkbox
          checked={selectedUsers.has(user.id)}
          onCheckedChange={(checked) => onSelectUser(user.id, checked as boolean)}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={getAvatarUrl(user.avatar)} />
            <AvatarFallback>
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{user.username}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {user.roles?.[0] || 'user'}
          </Badge>
          {user.rbac_roles && user.rbac_roles.length > 0 && (
            <Badge variant="outline" className="text-xs">
              +{user.rbac_roles.length} RBAC
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          className={getStatusClasses('active' as StatusType)}
          variant="secondary"
        >
          {getStatusText('active' as StatusType)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {user.project_id ? `Project ${user.project_id}` : 'No project'}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm text-muted-foreground">
          {user.last_login 
            ? new Date(user.last_login).toLocaleDateString()
            : 'Never'
          }
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <div className="font-medium">{user.active_keys || 0} active</div>
          <div className="text-muted-foreground">{user.keys_count || 0} total</div>
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewUser(user)}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => onUserAction('edit', user.id)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onUserAction('roles', user.id)}>
              <Shield className="h-4 w-4 mr-2" />
              Manage Roles
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUserAction('keys', user.id)}>
              <Key className="h-4 w-4 mr-2" />
              View Keys
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onUserAction('deactivate', user.id)}>
              <Ban className="h-4 w-4 mr-2" />
              Deactivate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUserAction('reset', user.id)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Password
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onUserAction('delete', user.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Keys</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
        </Table>
        {}
        {shouldVirtualize ? (
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
              <Table>
                <TableBody>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const user = users[virtualRow.index];
                    return (
                      <UserRow
                        key={user.id}
                        data-index={virtualRow.index}
                        user={user}
                        isSelected={selectedUsers.has(user.id)}
                        onSelectUser={onSelectUser}
                        onUserAction={onUserAction}
                        onViewUser={onViewUser}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <Table>
            <TableBody>
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelected={selectedUsers.has(user.id)}
                  onSelectUser={onSelectUser}
                  onUserAction={onUserAction}
                  onViewUser={onViewUser}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default UsersList;
