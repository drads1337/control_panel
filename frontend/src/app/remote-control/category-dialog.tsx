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
    product_id?: number
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
      {/* АДАПТАЦИЯ: w-[95vw] для мобильных, sm:max-w-[600px] для планшетов/десктопа */}
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-[600px] max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            {editingCategory ? 'Edit Section' : 'Manage Sections'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editingCategory ? 'Change the section parameters' : 'Add, edit, and delete feature sections'}
          </DialogDescription>
        </DialogHeader>

        {/* АДАПТАЦИЯ: overflow-y-auto применяется только к контентной части, чтобы шапка и подвал были фиксированы */}
        <div className="space-y-6 overflow-y-auto p-6 pt-2 flex-1">
          {/* Form Section */}
          <Card className="border-2">
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-3">
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

                  {/* АДАПТАЦИЯ: flex-col для мобильных (кнопки под цветом), sm:flex-row для планшета/ПК */}
                  <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                    <div className="space-y-2 w-full sm:w-auto">
                      <Label htmlFor="category-color">Color</Label>
                      <div className="flex items-center gap-2">
                         <Input
                          id="category-color"
                          type="color"
                          value={categoryFormData.color}
                          onChange={(e) => setCategoryFormData((prev: any) => ({ ...prev, color: e.target.value }))}
                          className="h-9 w-full sm:w-20" 
                        />
                        {/* Опционально: Текстовое отображение цвета на мобильных для удобства, если нужно */}
                      </div>
                    </div>

                    {/* АДАПТАЦИЯ: w-full и justify-end для выравнивания кнопок справа на всех экранах */}
                    <div className="flex gap-2 w-full sm:w-auto sm:ml-auto justify-end mt-2 sm:mt-0">
                      <ConditionalRender permission="remote_control.create" fallback={null}>
                        <Button
                          onClick={editingCategory ? undefined : onAddCategory}
                          size="sm"
                          className={!editingCategory ? "w-full sm:w-auto" : ""} 
                          disabled={!editingCategory && (categories.length >= 8 || !canCreate)}
                          title={!editingCategory && categories.length >= 8 ? "Maximum of 8 sections allowed" : !canCreate ? "You don't have permission to create sections" : ""}
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

          {/* List Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Existing Sections</h4>
              <span className="text-sm text-muted-foreground">
                {categories.length}/8 sections used
              </span>
            </div>

            {categories.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Settings className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <div className="text-sm text-muted-foreground">No sections created yet</div>
                </div>
              </div>
            ) : (
              <div className="divide-y border rounded-md">
                {categories.map(category => (
                  <div key={category.id} className="flex items-center justify-between p-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-sm truncate">{category.name}</h5>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{category.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEditCategory(category)}
                          disabled={!canEdit}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onDeleteCategory(category.id)}
                          disabled={!canDelete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t shrink-0">
          <Button 
            variant="outline" 
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              setCategoryDialogOpen(false)
              onResetCategoryForm()
            }}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}