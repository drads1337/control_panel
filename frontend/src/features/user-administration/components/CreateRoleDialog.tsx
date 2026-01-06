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
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { type Permission } from "@/features/user-administration/hooks/use-rbac"
import { cn } from '@/lib/utils.ts'

interface CreateRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
  loading: boolean
  form: {
    name: string
    description: string
    permissions: string[]
  }
  onFormChange: (form: any) => void
  permissions: Permission
}

const CreateRoleDialog: React.FC<CreateRoleDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  loading,
  form,
  onFormChange,
  permissions,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Create New Role
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create a new role with specific permissions.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="role-name" className="text-xs font-medium">
                Role Name *
              </Label>
              <Input
                id="role-name"
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                placeholder="Enter role name"
                disabled={loading}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="role-description"
                className="text-xs font-medium"
              >
                Description
              </Label>
              <Textarea
                id="role-description"
                value={form.description}
                onChange={(e) =>
                  onFormChange({ ...form, description: e.target.value })
                }
                placeholder="Enter role description"
                disabled={loading}
                className="text-xs min-h-[80px] resize-none"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-medium">Permissions</Label>
              
              {/* Permissions List Container */}
              <div className="border rounded-md p-3 space-y-4 bg-muted/10">
                {Object.keys(permissions).length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    No permissions available to assign.
                  </div>
                ) : (
                Object.entries(permissions).map(([resource, resourcePermissions]) => (
                  <div key={resource} className="space-y-2">
                    <h4 className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2">
                      {resource.replace("_", " ")}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {(resourcePermissions as { id: number; name: string; description?: string; action: string }[]).map((permission) => {
                          const isChecked = form.permissions.includes(
                            permission.name
                          )
                          return (
                            <div
                              key={permission.id}
                              className={cn(
                                "flex items-start space-x-2 p-2 rounded-md transition-colors cursor-pointer border border-transparent",
                                isChecked
                                  ? "bg-primary/5 border-primary/20"
                                  : "hover:bg-accent/50"
                              )}
                              onClick={() => {
                                if (!loading) {
                                  if (isChecked) {
                                    onFormChange({
                                      ...form,
                                      permissions: form.permissions.filter(
                                        (p) => p !== permission.name
                                      ),
                                    })
                                  } else {
                                    onFormChange({
                                      ...form,
                                      permissions: [
                                        ...form.permissions,
                                        permission.name,
                                      ],
                                    })
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
                                  className="text-xs font-medium cursor-pointer leading-none"
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
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
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
            onClick={onSubmit}
            disabled={loading}
            className="h-8 text-xs min-w-[80px]"
          >
            {loading ? (
              <Spinner className="size-3" />
            ) : (
              "Create Role"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CreateRoleDialog