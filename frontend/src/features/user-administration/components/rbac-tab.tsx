"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import CreateRoleDialog from "./create-role-dialog"
import EditRoleDialog from "./edit-role-dialog"
import { Plus, Shield, Key, Edit, Trash2, RefreshCw } from "lucide-react"
import { useRBACTab } from "@/features/user-administration/hooks/use-rbac-tab"
import { sanitizeString } from "@/lib/sanitization"
import { cn } from "@/lib/utils"

const RBACTab: React.FC = () => {
  const {
    roleForm,
    selectedRole,
    createDialogOpen,
    editDialogOpen,
    roles,
    permissions,
    isLoading: rbacLoading,
    error: rbacError,
    isCreating,
    isUpdating,
    isDeleting,
    setRoleForm,
    setCreateDialogOpen,
    setEditDialogOpen,
    handleRoleSubmit,
    handleDeleteRole,
    handleEditRole,
    resetRoleForm,
    refetchRoles,
    refetchPermissions,
  } = useRBACTab();

  const handleCreateDialogOpen = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      resetRoleForm();
    }
  };

  const handleEditDialogOpen = (open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      resetRoleForm();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 border rounded-lg bg-background shadow-sm">
        <CardHeader className="p-0 pb-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Roles</CardTitle>
              <CardDescription className="text-xs">
                {roles.length || 0} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 hover:bg-muted/50"
                onClick={() => refetchRoles()}
                disabled={rbacLoading}
              >
                <RefreshCw className={cn("size-3.5", rbacLoading && "animate-spin")} />
              </Button>
              <Button 
                variant="default" 
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleCreateDialogOpen(true)}
                disabled={rbacLoading}
              >
                <Plus className="size-3 mr-1.5" />
                Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-0 -mt-4">
          {rbacLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : rbacError ? (
            <div className="flex items-center justify-center py-6">
              <div className="text-destructive text-xs text-center px-4 bg-destructive/10 border border-destructive/20 rounded-md p-2">
                Error: {rbacError instanceof Error ? rbacError.message : 'An error occurred'}
              </div>
            </div>
          ) : roles.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
                <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">No roles found</div>
              </div>
            </div>
          ) : (
            <div className="divide-y border border-muted-foreground/10 rounded-md bg-muted/10">
              {roles.map((role) => (
                <div 
                  key={role.id} 
                  className="flex items-center justify-between p-3 border-b border-muted-foreground/10 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <h4 className="font-medium text-xs truncate">{role.name}</h4>
                        {role.is_system_role && (
                          <Badge variant="outline" className="text-xs border-muted-foreground/20 bg-muted/10 text-blue-600">System Role</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                        {role.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {role.permissions.length} permissions
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {role.user_count} users
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 justify-start">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-7 w-7 hover:bg-muted/50"
                      onClick={() => handleEditRole(role)}
                      disabled={rbacLoading}
                    >
                      <Edit className="size-3.5" />
                    </Button>
                    {!role.is_system_role && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteRole(role.id)}
                        disabled={isDeleting || rbacLoading}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="p-3 border rounded-lg bg-background shadow-sm">
        <CardHeader className="p-0 pb-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Permissions</CardTitle>
              <CardDescription className="text-xs">
                {Object.values(permissions).reduce((acc, perms) => acc + perms.length, 0) || 0} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 hover:bg-muted/50"
                onClick={() => refetchPermissions()}
                disabled={rbacLoading}
              >
                <RefreshCw className={cn("size-3.5", rbacLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-0 -mt-4">
          {rbacLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : Object.keys(permissions).length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
                <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">No permissions found</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(permissions).map(([resource, resourcePermissions]) => (
                <div key={resource} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-semibold capitalize">
                      {resource.replace('_', ' ')}
                    </h4>
                    <Badge variant="secondary" className="text-xs border-muted-foreground/20 bg-muted/10">
                      {resourcePermissions.length} permissions
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {resourcePermissions.map((permission) => (
                      <div 
                        key={permission.id}
                        className="flex items-start gap-2 p-2.5 border border-muted-foreground/10 rounded-lg bg-muted/10 hover:bg-muted/50 transition-colors"
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Key className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <h4 className="font-medium text-xs">{permission.name}</h4>
                            <Badge variant="outline" className="text-xs border-muted-foreground/20 bg-muted/10">
                              {permission.action}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {permission.description ? sanitizeString(permission.description) : 'No description'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRoleDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpen}
        onSubmit={handleRoleSubmit}
        loading={isCreating}
        form={roleForm}
        onFormChange={setRoleForm}
        permissions={permissions}
      />

      <EditRoleDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogOpen}
        onSubmit={handleRoleSubmit}
        loading={isUpdating}
        form={roleForm}
        onFormChange={setRoleForm}
        permissions={permissions}
      />
    </div>
  );
};

export default RBACTab;