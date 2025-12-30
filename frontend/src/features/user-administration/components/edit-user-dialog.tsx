"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { useEditUserDialog } from "@/features/user-administration/hooks/use-edit-user-dialog"
import { sanitizeString } from "@/lib/sanitization"
import { cn } from "@/lib/utils"
import type { User } from "@/entities/user"

interface EditUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onSuccess: () => void
}

const EditUserDialog: React.FC<EditUserDialogProps> = ({
  open,
  onOpenChange,
  user,
  onSuccess,
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
        <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 pb-1 bg-muted/5">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold">Edit Employee</DialogTitle>
              <DialogDescription className="text-xs">
                Loading user data...
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="flex justify-center items-center py-8 px-4">
            <div className="text-center">
              <Spinner className="h-6 w-6 mx-auto mb-4" />
              <p className="text-xs text-muted-foreground">Loading user data...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Edit Employee
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update employee information: {currentUser?.username || user?.username}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-medium">
                Username
              </Label>
              <Input
                id="username"
                value={currentUser?.username || user?.username || ""}
                disabled={true}
                className="bg-muted/30 h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Username cannot be changed
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first-name" className="text-xs font-medium">
                  First Name
                </Label>
                <Input
                  id="first-name"
                  value={form.first_name}
                  onChange={(e) =>
                    setForm({ ...form, first_name: e.target.value })
                  }
                  placeholder="Enter first name"
                  disabled={loading}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="last-name" className="text-xs font-medium">
                  Last Name
                </Label>
                <Input
                  id="last-name"
                  value={form.last_name}
                  onChange={(e) =>
                    setForm({ ...form, last_name: e.target.value })
                  }
                  placeholder="Enter last name"
                  disabled={loading}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter email"
                disabled={loading}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="token-balance"
                  className="text-xs font-medium"
                >
                  Token Balance
                </Label>
                <Input
                  id="token-balance"
                  type="number"
                  value={form.token_balance}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      token_balance: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                  disabled={loading}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="work-duration-days"
                  className="text-xs font-medium"
                >
                  Work Duration (days)
                </Label>
                <Input
                  id="work-duration-days"
                  type="number"
                  value={form.work_duration_days}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      work_duration_days: parseInt(e.target.value) || 7,
                    })
                  }
                  min="1"
                  max="365"
                  disabled={loading}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">RBAC Role *</Label>
              {rbacLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded-md">
                  <Spinner className="h-3 w-3 animate-spin" />
                  Loading roles...
                </div>
              ) : rbacError ? (
                <div className="text-xs text-red-500 px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded-md">Error: {rbacError}</div>
              ) : roles.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-2 border rounded-md bg-muted/10">
                  No roles available
                </div>
              ) : (
                <Select
                  value={form.selected_rbac_role?.toString() || ""}
                  onValueChange={async (value) => {
                    const roleId = value ? parseInt(value) : null
                    let rolePermissions: string[] = []
                    if (roleId) {
                      const role = roles.find((r) => r.id === roleId)
                      if (
                        role &&
                        role.permissions &&
                        Array.isArray(role.permissions)
                      ) {
                        rolePermissions = role.permissions
                      }
                    }
                    const previousRole = roles.find(
                      (r) => r.id === form.selected_rbac_role
                    )
                    const previousRolePermissions =
                      previousRole?.permissions || []
                    const hasCustomPermissions =
                      form.selected_permissions.length > 0 &&
                      JSON.stringify([...form.selected_permissions].sort()) !==
                        JSON.stringify([...previousRolePermissions].sort())
                    const shouldUpdatePermissions =
                      !hasCustomPermissions ||
                      form.selected_rbac_role !== roleId

                    setForm({
                      ...form,
                      selected_rbac_role: roleId,
                      selected_permissions: shouldUpdatePermissions
                        ? rolePermissions
                        : form.selected_permissions,
                    })
                  }}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {roles
                      .filter((role) => role.name !== "client")
                      .map((role) => (
                        <SelectItem
                          key={role.id}
                          value={role.id.toString()}
                          className="text-xs"
                        >
                          {role.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Product Access</Label>
              {productsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded-md">
                  <Spinner className="h-3 w-3 animate-spin" />
                  Loading products...
                </div>
              ) : productsError ? (
                <div className="text-xs text-red-500 px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded-md">Error: {productsError}</div>
              ) : (
                <div className="max-h-[150px] overflow-y-auto border rounded-md bg-muted/10 p-1">
                  {products.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">No products available</div>
                  ) : (
                    products.map((product) => {
                      const productId = Number(product.id);
                      const hasAccess = form.selected_products.some(id => Number(id) === productId);
                      return (
                        <div 
                          key={product.id} 
                          className="flex items-start space-x-2 p-2 hover:bg-accent/50 rounded transition-colors cursor-pointer"
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
                          <Label htmlFor={`product-${product.id}`} className="text-xs cursor-pointer flex-1" onClick={e => e.stopPropagation()}>
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-[10px] text-muted-foreground">{product.description ? sanitizeString(product.description) : 'No description'}</div>
                            </div>
                          </Label>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Permissions *</Label>
              {permissionsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded-md">
                  <Spinner className="h-3 w-3 animate-spin" />
                  Loading permissions...
                </div>
              ) : permissionsError ? (
                <div className="text-xs text-red-500 px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded-md">Error: {permissionsError}</div>
              ) : (
                <div className="max-h-[200px] overflow-y-auto border rounded-md bg-muted/10 p-3 space-y-4">
                  {(!availablePermissions || Object.keys(availablePermissions).length === 0) ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      No permissions available
                    </div>
                  ) : (
                    Object.entries(availablePermissions || {}).map(([resource, perms]) => (
                      <div key={resource} className="space-y-2">
                        <h4 className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2">
                          {resource.replace("_", " ")}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {perms.map((perm) => {
                            const isChecked = form.selected_permissions.includes(perm.name);
                            return (
                              <div
                                key={perm.id}
                                className={cn(
                                  "flex items-start space-x-2 p-2 rounded-md transition-colors cursor-pointer border border-transparent",
                                  isChecked
                                    ? "bg-primary/5 border-primary/20"
                                    : "hover:bg-accent/50"
                                )}
                                onClick={() => {
                                  if (!loading) {
                                    if (isChecked) {
                                      setForm({
                                        ...form,
                                        selected_permissions: form.selected_permissions.filter(
                                          (p) => p !== perm.name
                                        ),
                                      })
                                    } else {
                                      setForm({
                                        ...form,
                                        selected_permissions: [
                                          ...form.selected_permissions,
                                          perm.name,
                                        ],
                                      })
                                    }
                                  }
                                }}
                              >
                                <Checkbox
                                  id={`perm-${perm.id}`}
                                  checked={isChecked}
                                  onCheckedChange={() => {}} // Handled by parent div
                                  disabled={loading}
                                  className="mt-0.5"
                                />
                                <Label
                                  htmlFor={`perm-${perm.id}`}
                                  className="text-xs font-medium cursor-pointer leading-none pt-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {perm.action}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => handleUpdate()}
            disabled={loading}
            className="h-8 text-xs min-w-[80px]"
          >
            {loading ? (
              <Spinner className="size-3" />
            ) : (
              "Update Employee"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default EditUserDialog