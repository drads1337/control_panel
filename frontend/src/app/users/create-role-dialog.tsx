import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea'; // Assuming you have this component
import { Spinner } from '@/components/ui/spinner';
import { type Permission } from '@/hooks/use-rbac';
import { cn } from '@/lib/utils';

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
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 sm:p-6 border-b flex-shrink-0">
          <DialogTitle className="text-base">Create New Role</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Create a new role with specific permissions.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="role-name" className="text-sm font-medium">Role Name *</Label>
            <Input
              id="role-name"
              value={form.name}
              onChange={(e) => onFormChange({...form, name: e.target.value})}
              placeholder="Enter role name"
              disabled={loading}
              className="text-base sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="role-description"
              value={form.description}
              onChange={(e) => onFormChange({...form, description: e.target.value})}
              placeholder="Enter role description"
              disabled={loading}
              className="text-base sm:text-sm min-h-[80px] resize-none"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Permissions</Label>
            
            {/* Permissions List Container */}
            <div className="border rounded-md p-3 sm:p-4 space-y-5 bg-card">
              {Object.keys(permissions).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No permissions available to assign.
                </div>
              ) : (
                Object.entries(permissions).map(([resource, resourcePermissions]) => (
                  <div key={resource} className="space-y-2">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2">
                      {resource.replace('_', ' ')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {resourcePermissions.map((permission) => {
                        const isChecked = form.permissions.includes(permission.name);
                        return (
                          <div 
                            key={permission.id} 
                            className={cn(
                              "flex items-start space-x-3 p-2 rounded-md transition-colors cursor-pointer border border-transparent",
                              isChecked ? "bg-primary/5 border-primary/20" : "hover:bg-accent/50"
                            )}
                            onClick={() => {
                              if (!loading) {
                                if (isChecked) {
                                  onFormChange({
                                    ...form,
                                    permissions: form.permissions.filter(p => p !== permission.name)
                                  });
                                } else {
                                  onFormChange({
                                    ...form,
                                    permissions: [...form.permissions, permission.name]
                                  });
                                }
                              }
                            }}
                          >
                            <Checkbox
                              id={`permission-${permission.id}`}
                              checked={isChecked}
                              onCheckedChange={() => {}} // Handled by parent div
                              disabled={loading}
                              className="mt-0.5"
                            />
                            <div className="grid gap-0.5">
                              <Label 
                                htmlFor={`permission-${permission.id}`} 
                                className="text-sm font-medium cursor-pointer leading-none"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {permission.name}
                              </Label>
                              {permission.description && (
                                <p className="text-[10px] text-muted-foreground line-clamp-1">
                                  {permission.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-6 border-t bg-background flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <><Spinner className="mr-2 h-4 w-4 animate-spin" />Creating...</>
            ) : (
              'Create Role'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoleDialog;