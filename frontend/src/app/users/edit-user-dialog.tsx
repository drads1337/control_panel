import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { enhancedApi, getErrorMessage } from '@/shared/api/enhanced-client';
import { updateUser } from '@/entities/user/api/user';
import { toast } from 'sonner';
import type { User } from '@/entities/user';

interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  is_system_role: boolean;
  user_count: number;
  created_at: string;
  updated_at?: string;
}

interface Game {
  id: number;
  name: string;
  description?: string;
}

interface Permission {
  [resource: string]: Array<{ id: number; name: string; description: string; action: string }>;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess: () => void;
}

const EditUserDialog: React.FC<EditUserDialogProps> = ({
  open,
  onOpenChange,
  user,
  onSuccess
}) => {
  // Form state
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    token_balance: 0,
    work_duration_days: 7,
    selected_games: [] as number[],
    selected_rbac_role: null as number | null,
    selected_permissions: [] as string[]
  });

  // Loading states
  const [loading, setLoading] = useState(false);
  const [rbacLoading, setRbacLoading] = useState(false);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);

  // Error states
  const [rbacError, setRbacError] = useState<string | null>(null);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  // Data states
  const [roles, setRoles] = useState<Role[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Track last loaded user ID to prevent duplicate loads
  const lastLoadedUserIdRef = useRef<number | null>(null);

  // Load roles
  const loadRoles = useCallback(async (): Promise<Role[]> => {
    try {
      setRbacLoading(true);
      setRbacError(null);
      
      const response = await enhancedApi.get('/api/rbac/roles');
      const rolesData = response.data.roles || [];
      setRoles(rolesData);
      return rolesData;
    } catch (error) {
      console.error('Failed to load roles:', error);
      const errorMessage = getErrorMessage(error);
      setRbacError(errorMessage);
      toast.error(`Failed to load roles: ${errorMessage}`);
      return [];
    } finally {
      setRbacLoading(false);
    }
  }, []);

  // Load games
  const loadGames = useCallback(async (): Promise<Game[]> => {
    try {
      setGamesLoading(true);
      setGamesError(null);

      const response = await enhancedApi.get('/api/games');
      const gamesData = response.data.games || [];
      setGames(gamesData);
      return gamesData;
    } catch (error) {
      console.error('Failed to load games:', error);
      const errorMessage = getErrorMessage(error);
      setGamesError(errorMessage);
      toast.error(`Failed to load games: ${errorMessage}`);
      return [];
    } finally {
      setGamesLoading(false);
    }
  }, []);

  // Load permissions
  const loadPermissions = useCallback(async (): Promise<Permission> => {
    try {
      setPermissionsLoading(true);
      setPermissionsError(null);
      
      const response = await enhancedApi.get('/api/rbac/permissions');
      const permissionsData = (response.data.success && response.data.permissions) ? response.data.permissions : {};
      setAvailablePermissions(permissionsData);
      return permissionsData;
    } catch (error) {
      console.error('Failed to load permissions:', error);
      const errorMessage = getErrorMessage(error);
      setPermissionsError(errorMessage);
      toast.error(`Failed to load permissions: ${errorMessage}`);
      return {};
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  // Load user permissions
  const loadUserPermissions = useCallback(async (userId: number): Promise<string[]> => {
    try {
      const response = await enhancedApi.get(`/api/rbac/users/${userId}/permissions`);
      if (response.data.success && response.data.permissions) {
        return response.data.permissions as string[];
      }
      return [];
    } catch (error: any) {
      // Handle the expected "Static roles cannot manage RBAC" error gracefully
      // This is expected for users with static roles (owner/admin) and should not be logged as an error
      const errorMessage = error?.response?.data?.error || error?.message || '';
      if (errorMessage.includes('Static roles cannot manage RBAC')) {
        // Silently return empty permissions for static roles
        return [];
      }
      // Log other errors
      console.error('Failed to load user permissions:', error);
      return [];
    }
  }, []);

  // Initialize form when user changes
  useEffect(() => {
    // Only load if dialog is open and user is provided
    if (!open || !user) {
      // Reset ref when dialog closes
      if (!open) {
        lastLoadedUserIdRef.current = null;
      }
      return;
    }

    // Only proceed if we haven't loaded this user yet
    if (lastLoadedUserIdRef.current === user.id) {
      return;
    }

    // Mark this user as being loaded
    lastLoadedUserIdRef.current = user.id;
    setCurrentUser(user);
    setUserLoading(true);

    // Load all required data
    Promise.all([
      loadRoles(),
      loadGames(),
      loadPermissions(),
      loadUserPermissions(user.id)
    ]).then(([loadedRoles, , , userPermissions]) => {
      // Only update if this is still the current user (prevent race conditions)
      if (lastLoadedUserIdRef.current !== user.id) {
        return;
      }

      // Get user's RBAC role ID
      let userRoleId: number | null = null;
      if (user.rbac_roles && user.rbac_roles.length > 0) {
        userRoleId = user.rbac_roles[0].id;
      } else if (user.roles && user.roles.length > 0 && loadedRoles.length > 0) {
        // Fallback: try to find role by name
        const roleName = user.roles[0];
        const role = loadedRoles.find(r => r.name === roleName);
        if (role) {
          userRoleId = role.id;
        }
      }

      // Calculate work_duration_days from expires_at
      let workDurationDays = 7;
      if (user.expires_at) {
        const expiresDate = new Date(user.expires_at);
        const now = new Date();
        const diffMs = expiresDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        workDurationDays = diffDays > 0 ? diffDays : 7;
      }

      // Initialize form
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        token_balance: user.token_balance || 0,
        work_duration_days: workDurationDays,
        selected_games: [], // Will be populated if we fetch user's games
        selected_rbac_role: userRoleId,
        selected_permissions: userPermissions
      });
      setUserLoading(false);
    }).catch((error) => {
      console.error('Failed to load user data:', error);
      // Reset ref on error so we can retry
      if (lastLoadedUserIdRef.current === user.id) {
        lastLoadedUserIdRef.current = null;
      }
      setUserLoading(false);
    });
  }, [user?.id, open, loadRoles, loadGames, loadPermissions, loadUserPermissions]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        token_balance: 0,
        work_duration_days: 7,
        selected_games: [],
        selected_rbac_role: null,
        selected_permissions: []
      });
      setCurrentUser(null);
      setRbacError(null);
      setGamesError(null);
      setPermissionsError(null);
      lastLoadedUserIdRef.current = null;
    }
  }, [open]);

  // Handle form submission
  const handleUpdate = useCallback(async () => {
    if (!currentUser) return;

    try {
      // Validate email if provided
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        toast.error('Please enter a valid email address');
        return;
      }

      // Validate that a role is selected
      if (!form.selected_rbac_role) {
        toast.error('Please select a RBAC role');
        return;
      }

      setLoading(true);

      // Calculate expires_at from work_duration_days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + form.work_duration_days);

      // Update user data
      await updateUser(currentUser.id, {
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        email: form.email || undefined,
      });

      // Update token balance separately if needed
      if (form.token_balance !== (currentUser.token_balance || 0)) {
        try {
          await enhancedApi.post('/api/users/topup', {
            user_id: currentUser.id,
            amount: form.token_balance - (currentUser.token_balance || 0)
          });
        } catch (error) {
          console.error('Failed to update token balance:', error);
          const errorMessage = getErrorMessage(error);
          toast.error(`Error updating token balance: ${errorMessage}`);
        }
      }

      // Update RBAC roles and games
      try {
        await enhancedApi.put(`/api/users/${currentUser.id}`, {
          rbac_role_ids: [form.selected_rbac_role],
          game_ids: form.selected_games || [],
          expires_at: expiresAt.toISOString()
        });

        // Update role permissions
        try {
          const allPermissionIds: number[] = [];
          Object.values(availablePermissions).forEach(perms => {
            perms.forEach(perm => {
              if (form.selected_permissions.includes(perm.name)) {
                allPermissionIds.push(perm.id);
              }
            });
          });

          await enhancedApi.put(`/api/rbac/roles/${form.selected_rbac_role}/permissions`, {
            permission_ids: allPermissionIds
          });
        } catch (error) {
          console.error('Failed to update role permissions:', error);
          const errorMessage = getErrorMessage(error);
          toast.warning(`Role updated but failed to update permissions: ${errorMessage}`);
        }
      } catch (error) {
        console.error('Failed to update roles/games:', error);
        throw error;
      }

      toast.success('Employee updated successfully');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error(`Error updating employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [form, currentUser, availablePermissions, onOpenChange, onSuccess]);

  if (userLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Loading user data...
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center items-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading user data...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <DialogDescription>
            Update employee information: {currentUser?.username || user?.username}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={currentUser?.username || user?.username || ''}
              disabled={true}
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Username cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="first-name">First Name</Label>
            <Input
              id="first-name"
              value={form.first_name}
              onChange={(e) => setForm({...form, first_name: e.target.value})}
              placeholder="Enter first name"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="last-name">Last Name</Label>
            <Input
              id="last-name"
              value={form.last_name}
              onChange={(e) => setForm({...form, last_name: e.target.value})}
              placeholder="Enter last name"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})}
              placeholder="Enter email"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="token-balance">Token Balance</Label>
            <Input
              id="token-balance"
              type="number"
              value={form.token_balance}
              onChange={(e) => setForm({...form, token_balance: parseInt(e.target.value) || 0})}
              min="0"
              disabled={loading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="work-duration-days">Work Duration (days)</Label>
            <Input
              id="work-duration-days"
              type="number"
              value={form.work_duration_days}
              onChange={(e) => setForm({...form, work_duration_days: parseInt(e.target.value) || 7})}
              min="1"
              max="365"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              How long the employee will work (when their access expires)
            </p>
          </div>

          <div className="space-y-2">
            <Label>RBAC Role *</Label>
            {rbacLoading ? (
              <div className="text-sm text-muted-foreground">Loading roles...</div>
            ) : rbacError ? (
              <div className="text-sm text-red-500">Error loading roles: {rbacError}</div>
            ) : (
              <Select 
                value={form.selected_rbac_role?.toString() || ""} 
                onValueChange={(value) => 
                  setForm({
                    ...form,
                    selected_rbac_role: value ? parseInt(value) : null
                  })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter(role => role.name !== 'client')
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Game Access</Label>
            {gamesLoading ? (
              <div className="text-sm text-muted-foreground">Loading games...</div>
            ) : gamesError ? (
              <div className="text-sm text-red-500">Error loading games: {gamesError}</div>
            ) : (
              <div className="max-h-[150px] overflow-y-auto border rounded-md p-2 space-y-2">
                {games.map((game) => (
                  <div key={game.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`game-${game.id}`}
                      checked={form.selected_games.includes(game.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setForm({
                            ...form,
                            selected_games: [...form.selected_games, game.id]
                          })
                        } else {
                          setForm({
                            ...form,
                            selected_games: form.selected_games.filter(id => id !== game.id)
                          })
                        }
                      }}
                      disabled={loading}
                    />
                    <Label htmlFor={`game-${game.id}`} className="text-sm">
                      <div>
                        <div className="font-medium">{game.name}</div>
                        <div className="text-xs text-muted-foreground">{game.description || 'No description'}</div>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Permissions</Label>
            {permissionsLoading ? (
              <div className="text-sm text-muted-foreground">Loading permissions...</div>
            ) : permissionsError ? (
              <div className="text-sm text-red-500">Error loading permissions: {permissionsError}</div>
            ) : (
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 space-y-3">
                {Object.entries(availablePermissions || {}).map(([resource, perms]) => (
                  <div key={resource} className="space-y-1">
                    <div className="font-medium text-sm capitalize">{resource}</div>
                    <div className="space-y-1 pl-2">
                      {perms.map((perm) => (
                        <div key={perm.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`perm-${perm.id}`}
                            checked={form.selected_permissions.includes(perm.name)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setForm({
                                  ...form,
                                  selected_permissions: [...form.selected_permissions, perm.name]
                                })
                              } else {
                                setForm({
                                  ...form,
                                  selected_permissions: form.selected_permissions.filter(p => p !== perm.name)
                                })
                              }
                            }}
                            disabled={loading}
                          />
                          <Label htmlFor={`perm-${perm.id}`} className="text-sm cursor-pointer">
                            <div>
                              <div className="font-medium">{perm.action}</div>
                              {perm.description && (
                                <div className="text-xs text-muted-foreground">{perm.description}</div>
                              )}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {(!availablePermissions || Object.keys(availablePermissions).length === 0) && (
                  <div className="text-sm text-muted-foreground">No permissions available</div>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={loading}>
            {loading ? 'Updating...' : 'Update Employee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;

