import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from 'lucide-react'
import { RemoteCategory, RemoteFeature } from '@/lib/remote-control-api'
import { ConditionalRender } from '@/components/rbac/conditional-render'

interface FeatureDialogsProps {
  categories: RemoteCategory[]
  currentCategoryId: string
  addDialogOpen: boolean
  setAddDialogOpen: (open: boolean) => void
  editDialogOpen: boolean
  setEditDialogOpen: (open: boolean) => void
  editingFeature: RemoteFeature | null
  formData: {
    name: string
    description: string
    category_id: string
    enabled: boolean
  }
  setFormData: (data: any) => void
  onAddFeature: () => void
  onUpdateFeature: () => void
  onEditFeature: (feature: RemoteFeature) => void
  canCreate: boolean
  canEdit: boolean
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
  canCreate,
  canEdit
}: FeatureDialogsProps) {
  return (
    <>
      {/* Add Dialog */}
      <ConditionalRender permission="remote_control.create" fallback={null}>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setFormData((prev: any) => ({ 
                  ...prev, 
                  category_id: currentCategoryId,
                  name: '',
                  description: '',
                  enabled: false
                }))
              }}
              variant="default"
              size="sm"
              disabled={!canCreate}
              title={!canCreate ? "You don't have permission to create features" : ""}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add
            </Button>
          </DialogTrigger>
          {/* АДАПТАЦИЯ: w-[95vw] для мобильных, max-h для защиты от переполнения */}
          <DialogContent className="w-[95vw] sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">Add Feature</DialogTitle>
              <DialogDescription className="text-xs">
                Create a new feature (e.g. Aimbot, Wallhack, ESP, etc.)
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Aimbot, Wallhack, Player ESP"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Automatically aim at enemies"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData((prev: any) => ({ ...prev, category_id: value }))}
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
                  onCheckedChange={(checked) => setFormData((prev: any) => ({ ...prev, enabled: checked }))}
                />
                <Label htmlFor="enabled">Enable</Label>
              </div>
            </div>
            {/* АДАПТАЦИЯ: flex-col для мобильных кнопок */}
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAddDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={onAddFeature} 
                disabled={!canCreate}
                className="w-full sm:w-auto"
              >
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ConditionalRender>

      {/* Edit Dialog */}
      <ConditionalRender permission="remote_control.edit" fallback={null}>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          {/* АДАПТАЦИЯ: w-[95vw] для мобильных, max-h для защиты от переполнения */}
          <DialogContent className="w-[95vw] sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">Edit Feature</DialogTitle>
              <DialogDescription className="text-xs">
                Update feature settings and properties
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Aimbot, Wallhack, Player ESP"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Automatically aim at enemies"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData((prev: any) => ({ ...prev, category_id: value }))}
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
                  onCheckedChange={(checked) => setFormData((prev: any) => ({ ...prev, enabled: checked }))}
                />
                <Label htmlFor="edit-enabled">Enabled</Label>
              </div>
            </div>
            {/* АДАПТАЦИЯ: flex-col для мобильных кнопок */}
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEditDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={onUpdateFeature} 
                disabled={!canEdit}
                className="w-full sm:w-auto"
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