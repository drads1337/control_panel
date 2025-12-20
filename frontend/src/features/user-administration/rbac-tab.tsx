import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import CreateRoleDialog from './create-role-dialog';
import EditRoleDialog from './edit-role-dialog';
import { Plus, Shield, Key, Edit, Trash2, RefreshCw } from 'lucide-react';
import { useRBACTab } from '@/features/user-administration/hooks/use-rbac-tab';
import { sanitizeString } from '@/lib/utils/sanitization';
import { cn } from '@/lib/utils';

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
    <div className="space-y-4 md:space-y-6">
      <Card className="md:border md:shadow-sm md:bg-card border-0 shadow-none bg-transparent">
        <CardHeader className="pb-0 md:px-6 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm md:text-base">Roles</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {roles.length || 0} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => refetchRoles()}
                disabled={rbacLoading}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", rbacLoading && "animate-spin")} />
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleCreateDialogOpen(true)}
                disabled={rbacLoading}
                className="h-8 md:h-9"
              >
                <Plus className="h-4 w-4 md:mr-1.5" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 -mt-2 md:px-6 px-4">
          {rbacLoading ? (
            <div className="flex justify-center py-6 md:py-8">
              <Spinner message="Loading roles..." />
            </div>
          ) : rbacError ? (
            <div className="flex items-center justify-center py-6 md:py-8">
              <div className="text-red-500 text-xs md:text-sm text-center px-4">
                Error: {rbacError instanceof Error ? rbacError.message : 'An error occurred'}
              </div>
            </div>
          ) : roles.length === 0 ? (
            <div className="flex items-center justify-center py-10 md:py-12">
              <div className="text-center">
                <Shield className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground mx-auto mb-2 md:mb-3" />
                <div className="text-xs md:text-sm text-muted-foreground">No roles found</div>
              </div>
            </div>
          ) : (
            <div className="divide-y md:border md:rounded-md border-0">
              {roles.map((role) => (
                <div 
                  key={role.id} 
                  className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-3 border-b hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 mb-3 md:mb-0">
                    <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 md:gap-2 flex-wrap mb-1">
                        <h4 className="font-medium text-xs md:text-sm truncate">{role.name}</h4>
                        {role.is_system_role && (
                          <span className="text-xs text-blue-600 font-medium">System Role</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1 md:mb-1.5 line-clamp-2">
                        {role.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
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
                  <div className="flex items-center gap-1.5 md:gap-2 justify-end md:justify-start">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-9 w-9 md:h-8 md:w-8"
                      onClick={() => handleEditRole(role)}
                      disabled={rbacLoading}
                    >
                      <Edit className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </Button>
                    {!role.is_system_role && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9 md:h-8 md:w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteRole(role.id)}
                        disabled={isDeleting || rbacLoading}
                      >
                        <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:border md:shadow-sm md:bg-card border-0 shadow-none bg-transparent mt-4 md:mt-6">
        <CardHeader className="pb-0 md:px-6 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm md:text-base">Permissions</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {Object.values(permissions).reduce((acc, perms) => acc + perms.length, 0) || 0} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => refetchPermissions()}
                disabled={rbacLoading}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", rbacLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 -mt-2 md:px-6 px-4">
          {rbacLoading ? (
            <div className="flex justify-center py-6 md:py-8">
              <Spinner message="Loading permissions..." />
            </div>
          ) : Object.keys(permissions).length === 0 ? (
            <div className="flex items-center justify-center py-10 md:py-12">
              <div className="text-center">
                <Key className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground mx-auto mb-2 md:mb-3" />
                <div className="text-xs md:text-sm text-muted-foreground">No permissions found</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {Object.entries(permissions).map(([resource, resourcePermissions]) => (
                <div key={resource} className="space-y-2 md:space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs md:text-sm font-semibold capitalize">
                      {resource.replace('_', ' ')}
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      {resourcePermissions.length} permissions
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                    {resourcePermissions.map((permission) => (
                      <div 
                        key={permission.id}
                        className="flex items-start gap-2 md:gap-3 p-2.5 md:p-3 md:border border-0 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Key className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap mb-0.5 md:mb-1">
                            <h4 className="font-medium text-xs md:text-sm">{permission.name}</h4>
                            <Badge variant="outline" className="text-xs">
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