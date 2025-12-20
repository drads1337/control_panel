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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RemoteCategory, RemoteFeature } from '@/lib/remote-control-api'
import { ConditionalRender } from '@/components/rbac/conditional-render'

interface FeatureFormData {
  name: string
  description: string
  category_id: string
  enabled: boolean
}

interface FeatureDialogsProps {
  categories: RemoteCategory[]
  currentCategoryId: string
  addDialogOpen: boolean
  setAddDialogOpen: (open: boolean) => void
  editDialogOpen: boolean
  setEditDialogOpen: (open: boolean) => void
  editingFeature: RemoteFeature | null
  formData: FeatureFormData
  setFormData: (data: FeatureFormData | ((prev: FeatureFormData) => FeatureFormData)) => void
  onAddFeature: () => void
  onUpdateFeature: () => void
  onEditFeature: (feature: RemoteFeature) => void
  onResetForm: () => void
}

export default function FeatureDialogs({
  categories,
  currentCategoryId,
  addDialogOpen,
  setAddDialogOpen,
  editDialogOpen,
  setEditDialogOpen,
  editingFeature,
  formData,
  setFormData,
  onAddFeature,
  onUpdateFeature,
  onEditFeature,
  onResetForm
}: FeatureDialogsProps) {
  const isFormValid = formData.name.trim().length >= 1 && 
                      formData.description.trim().length >= 1 &&
                      formData.category_id.length >= 1

  const handleCloseAddDialog = (open: boolean) => {
    setAddDialogOpen(open)
    if (!open) {
      onResetForm()
    }
  }

  const handleCloseEditDialog = (open: boolean) => {
    setEditDialogOpen(open)
    if (!open) {
      onResetForm()
    }
  }

  // Pre-fill category when add dialog opens
  React.useEffect(() => {
    if (addDialogOpen && currentCategoryId && !formData.category_id) {
      setFormData((prev) => ({ ...prev, category_id: currentCategoryId }))
    }
  }, [addDialogOpen, currentCategoryId, formData.category_id, setFormData])

  return (
    <>
      <ConditionalRender permission="remote_control.create" fallback={null}>
        <Dialog open={addDialogOpen} onOpenChange={handleCloseAddDialog}>
          <DialogContent className="w-[95vw] sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-base">Add Feature</DialogTitle>
              <DialogDescription className="text-xs">
                Create a new feature
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Feature name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Feature description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, enabled: checked }))}
                />
                <Label htmlFor="enabled">Enable</Label>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleCloseAddDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={onAddFeature} 
                disabled={!isFormValid}
                title={!isFormValid ? "Please fill in all required fields" : ""}
              >
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ConditionalRender>

      <ConditionalRender permission="remote_control.edit" fallback={null}>
        <Dialog open={editDialogOpen} onOpenChange={handleCloseEditDialog}>
          <DialogContent className="w-[95vw] sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-base">Edit Feature</DialogTitle>
              <DialogDescription className="text-xs">
                Update feature settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Feature name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Feature description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, enabled: checked }))}
                />
                <Label htmlFor="edit-enabled">Enabled</Label>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleCloseEditDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={onUpdateFeature} 
                disabled={!isFormValid}
                title={!isFormValid ? "Please fill in all required fields" : ""}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ConditionalRender>
    </>
  )
}