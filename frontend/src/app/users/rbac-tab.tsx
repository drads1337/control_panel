import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CreateRoleDialog from './create-role-dialog';
import EditRoleDialog from './edit-role-dialog';
import { Plus, Shield, Key, Edit, Trash2 } from 'lucide-react';
import { useRBACTab } from '@/hooks/use-rbac-tab';

const RBACTab: React.FC = () => {
  const [rbacActiveTab, setRbacActiveTab] = useState('roles');

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Role-Based Access Control</CardTitle>
              <CardDescription>Manage roles, permissions, and user access</CardDescription>
            </div>
            <Button onClick={() => handleCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rbacLoading ? (
            <Spinner message="Loading RBAC data..." />
          ) : rbacError ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500">Error: {rbacError instanceof Error ? rbacError.message : 'An error occurred'}</div>
            </div>
          ) : (
            <Tabs value={rbacActiveTab} onValueChange={setRbacActiveTab} className="w-full">
              <TabsList className="inline-flex h-9 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-4">
                <TabsTrigger 
                  value="roles" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  Roles
                </TabsTrigger>
                <TabsTrigger 
                  value="permissions" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  Permissions
                </TabsTrigger>
              </TabsList>
              <TabsContent value="roles" className="space-y-4">
                {roles.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h4 className="text-lg font-semibold mb-2">No Roles Found</h4>
                    <p className="text-muted-foreground mb-4">
                      Create your first role to get started with role-based access control.
                    </p>
                    <Button onClick={() => handleCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Role
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {roles.map((role) => (
                      <div 
                        key={role.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors duration-200"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Shield className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{role.name}</h4>
                            <p className="text-sm text-muted-foreground">{role.description}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {role.permissions.length} permissions
                              </span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">
                                {role.user_count} users
                              </span>
                              {role.is_system_role && (
                                <>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <span className="text-xs text-blue-600">System Role</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditRole(role)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          {!role.is_system_role && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteRole(role.id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">System Permissions</h3>
                  <div className="text-sm text-muted-foreground">
                    {Object.keys(permissions).length} resource groups
                  </div>
                </div>

                {Object.keys(permissions).length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h4 className="text-lg font-semibold mb-2">No Permissions Found</h4>
                    <p className="text-muted-foreground">
                      No permissions are currently available in the system.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(permissions).map(([resource, resourcePermissions]) => (
                      <div key={resource} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold capitalize">
                            {resource.replace('_', ' ')} Permissions
                          </h4>
                          <Badge variant="secondary">
                            {resourcePermissions.length} permissions
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {resourcePermissions.map((permission) => (
                            <div 
                              key={permission.id}
                              className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent transition-colors duration-200"
                            >
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Key className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-sm truncate">
                                  {permission.name}
                                </h5>
                                <p className="text-xs text-muted-foreground truncate">
                                  {permission.description}
                                </p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {permission.action}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {}
      <CreateRoleDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpen}
        onSubmit={handleRoleSubmit}
        loading={isCreating}
        form={roleForm}
        onFormChange={setRoleForm}
        permissions={permissions}
      />

      {}
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
