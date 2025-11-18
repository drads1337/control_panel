import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Edit, Trash2, Settings } from 'lucide-react'
import { RemoteCategory } from '@/lib/remote-control-api'
import { ConditionalRender } from '@/components/rbac/conditional-render'

interface CategoryDialogProps {
  categoryDialogOpen: boolean
  setCategoryDialogOpen: (open: boolean) => void
  editingCategory: RemoteCategory | null
  categories: RemoteCategory[]
  categoryFormData: {
    name: string
    description: string
    color: string
  }
  setCategoryFormData: (data: any) => void
  onAddCategory: () => void
  onUpdateCategory: () => void
  onEditCategory: (category: RemoteCategory) => void
  onDeleteCategory: (categoryId: string) => void
  onResetCategoryForm: () => void
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

export default function CategoryDialog({
  categoryDialogOpen,
  setCategoryDialogOpen,
  editingCategory,
  categories,
  categoryFormData,
  setCategoryFormData,
  onAddCategory,
  onUpdateCategory,
  onEditCategory,
  onDeleteCategory,
  onResetCategoryForm,
  canCreate,
  canEdit,
  canDelete
}: CategoryDialogProps) {
  return (
    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] w-[90vw] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings className="h-5 w-5" />
            {editingCategory ? 'Edit Section' : 'Manage Sections'}
          </DialogTitle>
          <DialogDescription className="text-base">
            {editingCategory ? 'Change the section parameters' : 'Add, edit, and delete feature sections'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto max-h-[calc(90vh-180px)] pr-2">
          {}
          <Card className="border-2">
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-4">
                    {editingCategory ? 'Edit Section' : 'Add Section'}
                  </h4>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category-name">Name</Label>
                    <Input
                      id="category-name"
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData((prev: any) => ({ ...prev, name: e.target.value }))}
                      placeholder="Visual"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category-description">Description</Label>
                    <Input
                      id="category-description"
                      value={categoryFormData.description}
                      onChange={(e) => setCategoryFormData((prev: any) => ({ ...prev, description: e.target.value }))}
                      placeholder="Visual features"
                      className="h-9"
                    />
                  </div>

                  <div className="flex items-end gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category-color">Color</Label>
                      <Input
                        id="category-color"
                        type="color"
                        value={categoryFormData.color}
                        onChange={(e) => setCategoryFormData((prev: any) => ({ ...prev, color: e.target.value }))}
                        className="h-9 w-20"
                      />
                    </div>

                    <div className="flex gap-2 ml-auto">
                      <ConditionalRender permission="remote_control.create" fallback={null}>
                        <Button
                          onClick={editingCategory ? undefined : onAddCategory}
                          size="sm"
                          disabled={!editingCategory && (categories.length >= 8 || !canCreate)}
                          title={!editingCategory && categories.length >= 8 ? "Maximum of 8 sections allowed" : !canCreate ? "You don't have permission to create sections" : ""}
                          className="h-9"
                        >
                          Add
                        </Button>
                      </ConditionalRender>
                      <ConditionalRender permission="remote_control.edit" fallback={null}>
                        {editingCategory && (
                          <Button
                            onClick={onUpdateCategory}
                            size="sm"
                            disabled={!canEdit}
                            title={!canEdit ? "You don't have permission to edit sections" : ""}
                            className="h-9"
                          >
                            Save
                          </Button>
                        )}
                      </ConditionalRender>
                      {editingCategory && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onResetCategoryForm()
                          }}
                          className="h-9"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Existing Sections</h4>
              <span className="text-sm text-muted-foreground">
                {categories.length}/8 sections used
              </span>
            </div>

            {categories.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <Settings className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No sections created yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {categories.map(category => (
                  <Card key={category.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <h5 className="text-sm font-medium">{category.name}</h5>
                            <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <ConditionalRender permission="remote_control.edit" fallback={null}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditCategory(category)}
                              disabled={!canEdit}
                              title={!canEdit ? "You don't have permission to edit sections" : "Edit category"}
                              aria-label={!canEdit ? "Edit category (disabled)" : `Edit category ${category.name}`}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </ConditionalRender>
                          <ConditionalRender permission="remote_control.delete" fallback={null}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteCategory(category.id)}
                              disabled={!canDelete}
                              title={!canDelete ? "You don't have permission to delete sections" : "Delete category"}
                              aria-label={!canDelete ? "Delete category (disabled)" : `Delete category ${category.name}`}
                              className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </ConditionalRender>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => {
              setCategoryDialogOpen(false)
              onResetCategoryForm()
            }}
            className="h-9"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
