import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useEditUserDialog } from '@/hooks/use-edit-user-dialog';
import { sanitizeString } from '@/lib/sanitization';
import { cn } from '@/lib/utils';
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
        <DialogContent className="w-[95vw] sm:max-w-[500px] p-6">
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
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle className="text-base">Edit Employee</DialogTitle>
          <DialogDescription className="mt-1 text-xs truncate pr-4">
            Update employee information: {currentUser?.username || user?.username}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="flex-1 flex flex-col min-h-0 mt-2">
          <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4 pb-2">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">Username</Label>
              <Input
                id="username"
                value={currentUser?.username || user?.username || ''}
                disabled={true}
                className="bg-muted text-base sm:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Username cannot be changed
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name" className="text-sm font-medium">First Name</Label>
                <Input
                  id="first-name"
                  value={form.first_name}
                  onChange={(e) => setForm({...form, first_name: e.target.value})}
                  placeholder="Enter first name"
                  disabled={loading}
                  className="text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last-name" className="text-sm font-medium">Last Name</Label>
                <Input
                  id="last-name"
                  value={form.last_name}
                  onChange={(e) => setForm({...form, last_name: e.target.value})}
                  placeholder="Enter last name"
                  disabled={loading}
                  className="text-base sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({...form, email: e.target.value})}
                placeholder="Enter email"
                disabled={loading}
                className="text-base sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="token-balance" className="text-sm font-medium">Token Balance</Label>
                <Input
                  id="token-balance"
                  type="number"
                  value={form.token_balance}
                  onChange={(e) => setForm({...form, token_balance: parseInt(e.target.value) || 0})}
                  min="0"
                  disabled={loading}
                  className="text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="work-duration-days" className="text-sm font-medium">Work Duration (days)</Label>
                <Input
                  id="work-duration-days"
                  type="number"
                  value={form.work_duration_days}
                  onChange={(e) => setForm({...form, work_duration_days: parseInt(e.target.value) || 7})}
                  min="1"
                  max="365"
                  disabled={loading}
                  className="text-base sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">RBAC Role *</Label>
              {rbacLoading ? (
                <div className="text-sm text-muted-foreground py-2">Loading roles...</div>
              ) : rbacError ? (
                <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">Error: {rbacError}</div>
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
                  <SelectTrigger className="w-full text-base sm:text-sm">
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
              <Label className="text-sm font-medium">Product Access</Label>
              <p className="text-xs text-muted-foreground">Select products for access</p>
              {productsLoading ? (
                <div className="text-sm text-muted-foreground py-2">Loading products...</div>
              ) : productsError ? (
                <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">Error: {productsError}</div>
              ) : (
                <div className="max-h-[150px] overflow-y-auto border rounded-md bg-card p-1 space-y-1">
                  {products.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">No products available</div>
                  ) : (
                    products.map((product) => {
                      const productId = Number(product.id);
                      const hasAccess = form.selected_products.some(id => Number(id) === productId);
                      return (
                        <div 
                          key={product.id} 
                          className="flex items-start space-x-3 p-2 hover:bg-accent/50 rounded transition-colors cursor-pointer"
                          onClick={() => {
                            if (loading) return;
                            if (hasAccess) {
                              setForm({
                                ...form,
                                selected_products: form.selected_products.filter(id => Number(id) !== productId)
                              })
                            } else {
                              setForm({
                                ...form,
                                selected_products: [...form.selected_products, productId]
                              })
                            }
                          }}
                        >
                          <Checkbox
                            id={`product-${product.id}`}
                            checked={hasAccess}
                            onCheckedChange={() => {}} 
                            disabled={loading}
                            className="mt-1"
                          />
                          <Label htmlFor={`product-${product.id}`} className="text-sm cursor-pointer flex-1" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                              <div>
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description ? sanitizeString(product.description) : 'No description'}</div>
                              </div>
                              {hasAccess && (
                                <span className="text-xs text-green-600 shrink-0">
                                  ✓
                                </span>
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
              <Label className="text-sm font-medium">Permissions *</Label>
              <p className="text-xs text-muted-foreground">Configure individual permissions</p>
              {permissionsLoading ? (
                <div className="text-sm text-muted-foreground py-2">Loading permissions...</div>
              ) : permissionsError ? (
                <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">Error: {permissionsError}</div>
              ) : (
                <div className="max-h-[200px] overflow-y-auto border rounded-md bg-card p-2 space-y-4">
                  {Object.entries(availablePermissions || {}).map(([resource, perms]) => (
                    <div key={resource} className="space-y-1">
                      <div className="font-medium text-xs uppercase tracking-wider text-muted-foreground bg-muted/30 px-2 py-1 rounded">{resource}</div>
                      <div className="space-y-1 pl-1">
                        {perms.map((perm) => {
                          const isChecked = form.selected_permissions.includes(perm.name);
                          return (
                            <div 
                              key={perm.id} 
                              className="flex items-center space-x-2 p-1.5 hover:bg-accent/50 rounded cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (loading) return;
                                const newPermissions = isChecked
                                  ? form.selected_permissions.filter(p => p !== perm.name)
                                  : [...form.selected_permissions, perm.name];
                                setForm({ ...form, selected_permissions: newPermissions });
                              }}
                            >
                              <Checkbox
                                id={`perm-${perm.id}`}
                                checked={isChecked}
                                onCheckedChange={() => {}}
                                disabled={loading}
                              />
                              <Label htmlFor={`perm-${perm.id}`} className="text-sm cursor-pointer flex-1" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{perm.action}</span>
                                  {isChecked && (
                                    <span className="text-[10px] text-green-600 font-medium shrink-0">✓</span>
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
                    <div className="text-sm text-muted-foreground text-center py-4">No permissions available</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-4 border-t mt-auto">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => handleUpdate()} 
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? 'Updating...' : 'Update Employee'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;