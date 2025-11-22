import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { type Permission } from '@/hooks/use-rbac';

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  loading: boolean;
  form: {
    name: string;
    description: string;
    permissions: string[];
  };
  onFormChange: (form: any) => void;
  permissions: Permission;
}

const CreateRoleDialog: React.FC<CreateRoleDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  loading,
  form,
  onFormChange,
  permissions
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Create New Role</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Create a new role with specific permissions for your project.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Role Name *</Label>
            <Input
              id="role-name"
              value={form.name}
              onChange={(e) => onFormChange({...form, name: e.target.value})}
              placeholder="Enter role name"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-description">Description</Label>
            <textarea
              id="role-description"
              className="w-full min-h-[80px] px-3 py-2 border border-input bg-background rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={form.description}
              onChange={(e) => onFormChange({...form, description: e.target.value})}
              placeholder="Enter role description"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="max-h-[300px] overflow-y-auto border rounded-md p-4 space-y-4">
              {Object.keys(permissions).length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No permissions available
                </div>
              ) : (
                Object.entries(permissions).map(([resource, resourcePermissions]) => (
                  <div key={resource} className="space-y-2">
                    <h4 className="font-medium text-sm capitalize">
                      {resource.replace('_', ' ')} Permissions
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {resourcePermissions.map((permission) => (
                        <div key={permission.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`permission-${permission.id}`}
                            checked={form.permissions.includes(permission.name)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                onFormChange({
                                  ...form,
                                  permissions: [...form.permissions, permission.name]
                                });
                              } else {
                                onFormChange({
                                  ...form,
                                  permissions: form.permissions.filter(p => p !== permission.name)
                                });
                              }
                            }}
                            disabled={loading}
                          />
                          <Label htmlFor={`permission-${permission.id}`} className="text-sm">
                            {permission.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? (<><Spinner className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : 'Create Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoleDialog;
