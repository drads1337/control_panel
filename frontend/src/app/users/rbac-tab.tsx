import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import CreateRoleDialog from './create-role-dialog';
import EditRoleDialog from './edit-role-dialog';
import { Plus, Shield, Key, Edit, Trash2 } from 'lucide-react';
import { useRBACTab } from '@/hooks/use-rbac-tab';
import { sanitizeString } from '@/lib/sanitization';

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
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Roles</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {roles.length || 0} total
              </CardDescription>
            </div>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => handleCreateDialogOpen(true)}
              disabled={rbacLoading}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 -mt-3">
          {rbacLoading ? (
            <Spinner message="Loading roles..." />
          ) : rbacError ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500">Error: {rbacError instanceof Error ? rbacError.message : 'An error occurred'}</div>
            </div>
          ) : roles.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">No roles found</div>
              </div>
                  </div>
                ) : (
            <div className="divide-y">
                    {roles.map((role) => (
                      <div 
                        key={role.id} 
                  className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors"
                      >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-primary" />
                          </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm truncate">{role.name}</h4>
                              {role.is_system_role && (
                                  <span className="text-xs text-blue-600">System Role</span>
                              )}
                            </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground truncate">
                          {role.description || 'No description'}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          • {role.permissions.length} permissions
                        </span>
                        <span className="text-xs text-muted-foreground">
                          • {role.user_count} users
                        </span>
                      </div>
                          </div>
                        </div>
                  <div className="flex items-center gap-1">
                          <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8"
                            onClick={() => handleEditRole(role)}
                      disabled={rbacLoading}
                          >
                      <Edit className="h-4 w-4" />
                          </Button>
                          {!role.is_system_role && (
                            <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteRole(role.id)}
                        disabled={isDeleting || rbacLoading}
                            >
                        <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Permissions</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {Object.values(permissions).reduce((acc, perms) => acc + perms.length, 0) || 0} total
              </CardDescription>
                  </div>
                </div>
        </CardHeader>
        <CardContent className="pt-0 -mt-3">
          {rbacLoading ? (
            <Spinner message="Loading permissions..." />
          ) : Object.keys(permissions).length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Key className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">No permissions found</div>
              </div>
                  </div>
                ) : (
            <div className="space-y-4">
                    {Object.entries(permissions).map(([resource, resourcePermissions]) => (
                <div key={resource} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold capitalize">
                      {resource.replace('_', ' ')}
                          </h4>
                    <Badge variant="secondary" className="text-xs">
                            {resourcePermissions.length} permissions
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {resourcePermissions.map((permission) => (
                            <div 
                              key={permission.id}
                        className="flex items-center gap-3 p-2.5 border rounded-lg hover:bg-accent/50 transition-colors"
                            >
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Key className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-sm truncate">{permission.name}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {permission.action}
                                  </Badge>
                                </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-muted-foreground truncate">
                              {permission.description ? sanitizeString(permission.description) : 'No description'}
                            </p>
                          </div>
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
