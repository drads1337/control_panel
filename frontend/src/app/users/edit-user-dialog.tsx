import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useEditUserDialog } from '@/hooks/use-edit-user-dialog';
import { sanitizeString } from '@/lib/sanitization';
import type { User } from '@/entities/user';

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
  const {
    form,
    setForm,
    loading,
    rbacLoading,
    productsLoading,
    permissionsLoading,
    userLoading,
    rbacError,
    productsError,
    permissionsError,
    roles,
    products,
    availablePermissions,
    currentUser,
    handleUpdate,
  } = useEditUserDialog(user, open, () => {
    onOpenChange(false);
    onSuccess();
  });

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
            ) : roles.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-2 border rounded-md">
                No roles available
              </div>
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
                              <div className="text-xs text-muted-foreground">{product.description ? sanitizeString(product.description) : 'No description'}</div>
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
          <Button onClick={() => handleUpdate()} disabled={loading}>
            {loading ? 'Updating...' : 'Update Employee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;
