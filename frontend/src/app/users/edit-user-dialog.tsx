import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { enhancedApi, getErrorMessage } from '@/shared/api/enhanced-client';
import { updateUser } from '@/entities/user/api/user';
import { getProducts } from '@/entities/product/api/product';
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

interface Product {
  id: number;
  name: string;
  description: string | null;
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

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    token_balance: 0,
    work_duration_days: 7,
    selected_products: [] as number[],
    selected_rbac_role: null as number | null,
    selected_permissions: [] as string[]
  });

  const [loading, setLoading] = useState(false);
  const [rbacLoading, setRbacLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);

  const [rbacError, setRbacError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const lastLoadedUserIdRef = useRef<number | null>(null);

  const loadRoles = useCallback(async (): Promise<Role[]> => {
    try {
      setRbacLoading(true);
      setRbacError(null);

      const response = await enhancedApi.get('/api/rbac/roles');
      const rolesData = response.data.roles || [];
      setRoles(rolesData);
      return rolesData;
    } catch (error) {

      const errorMessage = getErrorMessage(error);
      setRbacError(errorMessage);
      toast.error(`Failed to load roles: ${errorMessage}`);
      return [];
    } finally {
      setRbacLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async (): Promise<Product[]> => {
    try {
      setProductsLoading(true);
      setProductsError(null);

      // Use universal API function - it uses /api/products endpoint
      const response = await getProducts('all');
      const productsData = response.products || [];
      setProducts(productsData);
      return productsData;
    } catch (error) {

      const errorMessage = getErrorMessage(error);
      setProductsError(errorMessage);
      toast.error(`Failed to load products: ${errorMessage}`);
      return [];
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const loadPermissions = useCallback(async (): Promise<Permission> => {
    try {
      setPermissionsLoading(true);
      setPermissionsError(null);

      const response = await enhancedApi.get('/api/rbac/permissions');
      const permissionsData = (response.data.success && response.data.permissions) ? response.data.permissions : {};
      setAvailablePermissions(permissionsData);
      return permissionsData;
    } catch (error) {

      const errorMessage = getErrorMessage(error);
      setPermissionsError(errorMessage);
      toast.error(`Failed to load permissions: ${errorMessage}`);
      return {};
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  const loadUserPermissions = useCallback(async (userId: number): Promise<string[]> => {
    try {

      const response = await enhancedApi.get(`/api/rbac/users/${userId}/permissions`);
      if (response.data.success && response.data.permissions) {
        const permissions = response.data.permissions as string[];

        return permissions;
      }
      return [];
    } catch (error: any) {

      const errorMessage = error?.response?.data?.error || error?.message || '';
      if (errorMessage.includes('Static roles cannot manage RBAC')) {

        return [];
      }

      return [];
    }
  }, []);

  const loadUserProductAccess = useCallback(async (userId: number): Promise<number[]> => {
    try {
      // Use universal endpoint - products instead of products
      const response = await enhancedApi.get(`/api/clients/${userId}/products`);
      if (Array.isArray(response.data)) {

        return response.data
          .filter((product: any) => product.has_access === true)
          .map((product: any) => product.product_id || product.id);
      }
      return [];
    } catch (error: any) {

      return [];
    }
  }, []);

  useEffect(() => {

    if (!open || !user) {

      if (!open) {
        lastLoadedUserIdRef.current = null;
      }
      return;
    }

    if (lastLoadedUserIdRef.current === user.id) {
      return;
    }

    lastLoadedUserIdRef.current = user.id;
    setCurrentUser(user);
    setUserLoading(true);

    Promise.all([
      loadRoles(),
      loadProducts(),
      loadPermissions(),
      loadUserPermissions(user.id),
      loadUserProductAccess(user.id)
    ]).then(([loadedRoles, , , userPermissions, userProductAccess]) => {

      if (lastLoadedUserIdRef.current !== user.id) {
        return;
      }

      let userRoleId: number | null = null;
      if (user.rbac_roles && user.rbac_roles.length > 0) {
        userRoleId = user.rbac_roles[0].id;
      } else if (user.roles && user.roles.length > 0 && loadedRoles.length > 0) {

        const roleName = user.roles[0];
        const role = loadedRoles.find(r => r.name === roleName);
        if (role) {
          userRoleId = role.id;
        }
      }

      let workDurationDays = 7;
      if (user.expires_at) {
        const expiresDate = new Date(user.expires_at);
        const now = new Date();
        const diffMs = expiresDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        workDurationDays = diffDays > 0 ? diffDays : 7;
      }

      let defaultPermissions: string[] = [];
      if (userRoleId) {
        const role = loadedRoles.find(r => r.id === userRoleId);
        if (role && role.permissions && Array.isArray(role.permissions)) {
          defaultPermissions = role.permissions;
        }
      }

      const initialPermissions = userPermissions.length > 0 ? userPermissions : defaultPermissions;

      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        token_balance: user.token_balance || 0,
        work_duration_days: workDurationDays,
        selected_products: userProductAccess,
        selected_rbac_role: userRoleId,
        selected_permissions: initialPermissions
      });
      setUserLoading(false);
    }).catch((error) => {

      if (lastLoadedUserIdRef.current === user.id) {
        lastLoadedUserIdRef.current = null;
      }
      setUserLoading(false);
    });
  }, [user?.id, open, loadRoles, loadProducts, loadPermissions, loadUserPermissions, loadUserProductAccess]);

  useEffect(() => {
    if (!open) {
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        token_balance: 0,
        work_duration_days: 7,
        selected_products: [],
        selected_rbac_role: null,
        selected_permissions: []
      });
      setCurrentUser(null);
      setRbacError(null);
      setProductsError(null);
      setPermissionsError(null);
      lastLoadedUserIdRef.current = null;
    }
  }, [open]);

  const handleUpdate = useCallback(async () => {
    if (!currentUser) return;

    try {

      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        toast.error('Please enter a valid email address');
        return;
      }

      if (!form.selected_rbac_role) {
        toast.error('Please select a RBAC role');
        return;
      }

      if (!form.selected_permissions || form.selected_permissions.length === 0) {
        toast.error('At least one permission is required. Please select at least one permission.');
        return;
      }

      setLoading(true);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + form.work_duration_days);

      await updateUser(currentUser.id, {
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        email: form.email || undefined,
      });

      if (form.token_balance !== (currentUser.token_balance || 0)) {
        try {
          await enhancedApi.post('/api/users/topup', {
            user_id: currentUser.id,
            amount: form.token_balance - (currentUser.token_balance || 0)
          });
        } catch (error) {

          const errorMessage = getErrorMessage(error);
          toast.error(`Error updating token balance: ${errorMessage}`);
        }
      }

      try {
        await enhancedApi.put(`/api/users/${currentUser.id}`, {
          rbac_role_ids: [form.selected_rbac_role],
          expires_at: expiresAt.toISOString()
        });
      } catch (error) {

        throw error;
      }

      try {

        const currentProductAccess = await loadUserProductAccess(currentUser.id);
        const currentProductSet = new Set(currentProductAccess);
        const newProductSet = new Set(form.selected_products || []);

        const productsToAdd = form.selected_products.filter(productId => !currentProductSet.has(productId));
        const productsToRemove = currentProductAccess.filter(productId => !newProductSet.has(productId));

        for (const productId of productsToAdd) {
          try {
            // Use universal endpoint - products instead of products
            await enhancedApi.post(`/api/clients/${currentUser.id}/products/${productId}/toggle`);
          } catch (error) {

          }
        }

        for (const productId of productsToRemove) {
          try {
            // Use universal endpoint - products instead of products
            await enhancedApi.post(`/api/clients/${currentUser.id}/products/${productId}/toggle`);
          } catch (error) {

          }
        }
      } catch (error) {

        const errorMessage = getErrorMessage(error);
        toast.warning(`User updated but failed to update product access: ${errorMessage}`);
      }

      try {
        const permissionsToSend = form.selected_permissions || [];

        const response = await enhancedApi.put(`/api/rbac/users/${currentUser.id}/permissions`, {
          permissions: permissionsToSend
        });

      } catch (error) {

        const errorMessage = getErrorMessage(error);

        if (!errorMessage.includes('Static roles cannot manage RBAC')) {
          toast.warning(`User updated but failed to update permissions: ${errorMessage}`);
        }
      }

      toast.success('Employee updated successfully');
      onOpenChange(false);
      onSuccess();
    } catch (error) {

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
                onValueChange={async (value) => {
                  const roleId = value ? parseInt(value) : null;

                  let rolePermissions: string[] = [];
                  if (roleId) {
                    const role = roles.find(r => r.id === roleId);
                    if (role && role.permissions && Array.isArray(role.permissions)) {
                      rolePermissions = role.permissions;
                    }
                  }

                  const previousRole = roles.find(r => r.id === form.selected_rbac_role);
                  const previousRolePermissions = previousRole?.permissions || [];
                  const hasCustomPermissions = form.selected_permissions.length > 0 && 
                    JSON.stringify([...form.selected_permissions].sort()) !== JSON.stringify([...previousRolePermissions].sort());

                  const shouldUpdatePermissions = !hasCustomPermissions || form.selected_rbac_role !== roleId;

                  setForm({
                    ...form,
                    selected_rbac_role: roleId,

                    selected_permissions: shouldUpdatePermissions ? rolePermissions : form.selected_permissions
                  });
                }}
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
            <Label>Product Access</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select products this user has access to
            </p>
            {productsLoading ? (
              <div className="text-sm text-muted-foreground">Loading products...</div>
            ) : productsError ? (
              <div className="text-sm text-red-500">Error loading products: {productsError}</div>
            ) : (
              <div className="max-h-[150px] overflow-y-auto border rounded-md p-2 space-y-2">
                {products.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">No products available</div>
                ) : (
                  products.map((product) => {
                    const hasAccess = form.selected_products.includes(product.id);
                    return (
                      <div key={product.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`product-${product.id}`}
                          checked={hasAccess}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setForm({
                                ...form,
                                selected_products: [...form.selected_products, product.id]
                              })
                            } else {
                              setForm({
                                ...form,
                                selected_products: form.selected_products.filter(id => id !== product.id)
                              })
                            }
                          }}
                          disabled={loading}
                        />
                        <Label htmlFor={`product-${product.id}`} className="text-sm cursor-pointer flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-muted-foreground">{product.description || 'No description'}</div>
                            </div>
                            {hasAccess && (
                              <span className="text-xs text-green-600 font-medium ml-2">✓ Access</span>
                            )}
                          </div>
                        </Label>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Permissions *</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Configure individual permissions for this user. Default permissions from the selected role are shown. At least one permission is required.
            </p>
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
                      {perms.map((perm) => {
                        const isChecked = form.selected_permissions.includes(perm.name);
                        return (
                          <div key={perm.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`perm-${perm.id}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const newPermissions = checked
                                  ? [...form.selected_permissions, perm.name]
                                  : form.selected_permissions.filter(p => p !== perm.name);

                                setForm({
                                  ...form,
                                  selected_permissions: newPermissions
                                });
                              }}
                              disabled={loading}
                            />
                            <Label htmlFor={`perm-${perm.id}`} className="text-sm cursor-pointer flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{perm.action}</div>
                                  {perm.description && (
                                    <div className="text-xs text-muted-foreground">{perm.description}</div>
                                  )}
                                </div>
                                {isChecked && (
                                  <span className="text-xs text-green-600 font-medium ml-2">✓ Enabled</span>
                                )}
                              </div>
                            </Label>
                          </div>
                        );
                      })}
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
