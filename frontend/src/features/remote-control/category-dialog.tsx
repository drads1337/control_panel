import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Edit, Trash2, Plus, X, Check } from 'lucide-react'
import { RemoteCategory } from '@/lib/remote-control-api'
import { ConditionalRender } from '@/lib/rbac/conditional-render'

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
  setCategoryFormData: (data: CategoryDialogProps['categoryFormData'] | ((prev: CategoryDialogProps['categoryFormData']) => CategoryDialogProps['categoryFormData'])) => void
  onAddCategory: () => void
  onUpdateCategory: () => void
  onEditCategory: (category: RemoteCategory) => void
  onDeleteCategory: (categoryId: string) => void
  onResetCategoryForm: () => void
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
  onResetCategoryForm
}: CategoryDialogProps) {
  
  const handleClose = () => {
    setCategoryDialogOpen(false)
    onResetCategoryForm()
  }

  const isFormValid = categoryFormData.name.trim().length >= 1 && 
                      categoryFormData.description.trim().length >= 1

  return (
    <Dialog open={categoryDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-[400px] p-0 gap-0 overflow-hidden bg-background">
        
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Manage Sections</span>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {categories.length}/8
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Form Area - Compact & Dense */}
          <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
            <div className="flex gap-2 items-end">
              <div className="space-y-1">
                <Label htmlFor="color" className="text-[10px] uppercase text-muted-foreground font-bold">Color</Label>
                <div className="relative overflow-hidden rounded-md w-8 h-8 border shadow-sm">
                   <Input
                    id="color"
                    type="color"
                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                    value={categoryFormData.color}
                    onChange={(e) => setCategoryFormData((prev) => ({ ...prev, color: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-1 flex-1">
                <Label htmlFor="name" className="text-[10px] uppercase text-muted-foreground font-bold">Name *</Label>
                <Input
                  id="name"
                  className="h-8 text-sm"
                  placeholder="e.g. Visual"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  minLength={1}
                />
              </div>
            </div>

            <div className="flex gap-2 items-end">
              <div className="space-y-1 flex-1">
                <Label htmlFor="desc" className="text-[10px] uppercase text-muted-foreground font-bold">Description *</Label>
                <Input
                  id="desc"
                  className="h-8 text-xs"
                  placeholder="Short description..."
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData((prev) => ({ ...prev, description: e.target.value }))}
                  required
                  minLength={1}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-1">
                {editingCategory ? (
                  <>
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onResetCategoryForm}>
                        <X className="h-4 w-4" />
                     </Button>
                     <ConditionalRender permission="remote_control.edit" fallback={null}>
                       <Button 
                         size="icon" 
                         className="h-8 w-8" 
                         onClick={onUpdateCategory} 
                         disabled={!isFormValid}
                         title={!isFormValid ? "Please fill in all required fields" : ""}
                       >
                          <Check className="h-4 w-4" />
                       </Button>
                     </ConditionalRender>
                  </>
                ) : (
                  <ConditionalRender permission="remote_control.create" fallback={null}>
                    <Button 
                      size="icon" 
                      className="h-8 w-8 shrink-0"
                      onClick={onAddCategory}
                      disabled={categories.length >= 8 || !isFormValid}
                      title={
                        categories.length >= 8 
                          ? "Maximum of 8 sections allowed" 
                          : !isFormValid 
                              ? "Please fill in all required fields" 
                              : ""
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </ConditionalRender>
                )}
              </div>
            </div>
          </div>

          {/* Existing List */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground px-1">
              Existing ({categories.length})
            </h4>
            
            <div className="max-h-[250px] overflow-y-auto pr-1 -mr-1 space-y-1">
              {categories.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-md">
                  No sections yet. Add one above.
                </div>
              ) : (
                categories.map(category => (
                  <div 
                    key={category.id} 
                    className={`group flex items-center justify-between p-2 rounded-md border text-sm transition-colors hover:bg-muted/50 ${editingCategory?.id === category.id ? 'bg-muted border-primary/20' : 'bg-background'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full ring-2 ring-border shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate leading-none">
                          {category.name ? category.name : <span className="text-muted-foreground italic">Unnamed</span>}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate leading-none mt-1">
                          {category.description ? category.description : <span className="italic">No description</span>}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ConditionalRender permission="remote_control.edit" fallback={null}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onEditCategory(category)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </ConditionalRender>
                      <ConditionalRender permission="remote_control.delete" fallback={null}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onDeleteCategory(category.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </ConditionalRender>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}