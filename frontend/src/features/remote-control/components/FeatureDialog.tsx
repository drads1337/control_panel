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
import { Textarea } from '@/components/ui/textarea'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { X, Check, Plus } from 'lucide-react'
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render'
import type { RemoteFeature } from '@/shared/lib/remote-control-api'
import type { RemoteCategory } from '../category'

import type { FeatureFormData, FeatureType, FeatureStatus } from '../hooks/use-remote-control-logic'

export type { FeatureType, FeatureStatus, FeatureFormData }

interface FeatureDialogProps {
  featureDialogOpen: boolean
  setFeatureDialogOpen: (open: boolean) => void
  editingFeature: RemoteFeature | null
  categories: RemoteCategory[]
  featureFormData: FeatureFormData
  setFeatureFormData: (data: FeatureFormData | ((prev: FeatureFormData) => FeatureFormData)) => void
  onAddFeature: () => void
  onUpdateFeature: () => void
  onResetFeatureForm: () => void
}

export function FeatureDialog({
  featureDialogOpen,
  setFeatureDialogOpen,
  editingFeature,
  categories,
  featureFormData,
  setFeatureFormData,
  onAddFeature,
  onUpdateFeature,
  onResetFeatureForm
}: FeatureDialogProps) {
  
  const handleClose = () => {
    setFeatureDialogOpen(false)
    onResetFeatureForm()
  }

  const isFormValid = featureFormData.name.trim().length >= 1 && 
                      featureFormData.description.trim().length >= 1 &&
                      featureFormData.category_id !== ''

  const featureTypes: { value: FeatureType; label: string }[] = [
    { value: 'toggle', label: 'Toggle (On/Off)' },
    { value: 'slider', label: 'Slider (0-100)' },
    { value: 'int-slider', label: 'Integer Slider' },
    { value: 'float-slider', label: 'Float Slider' },
    { value: 'select', label: 'Select (Dropdown)' },
  ]

  const statusOptions: { value: FeatureStatus; label: string }[] = [
    { value: 'offline', label: 'Offline' },
    { value: 'online', label: 'Online' },
    { value: 'maintenance', label: 'Maintenance' },
  ]

  const handleSave = () => {
    if (editingFeature) {
      onUpdateFeature()
    } else {
      onAddFeature()
    }
  }

  return (
    <Dialog open={featureDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">
        
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="text-sm font-semibold">
            {editingFeature ? 'Edit Feature' : 'Create Feature'}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Form Area */}
          <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
            
            {/* Name */}
            <div className="space-y-1">
              <Label htmlFor="name" className="text-[10px] uppercase text-muted-foreground font-bold">
                Name *
              </Label>
              <Input
                id="name"
                className="h-8 text-sm"
                placeholder="e.g. Smooth Aimbot"
                value={featureFormData.name}
                onChange={(e) => setFeatureFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
                minLength={1}
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label htmlFor="description" className="text-[10px] uppercase text-muted-foreground font-bold">
                Description *
              </Label>
              <Textarea
                id="description"
                className="min-h-[60px] text-sm"
                placeholder="Feature description..."
                value={featureFormData.description}
                onChange={(e) => setFeatureFormData((prev) => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <Label htmlFor="category" className="text-[10px] uppercase text-muted-foreground font-bold">
                Category *
              </Label>
              <Select
                value={featureFormData.category_id}
                onValueChange={(value) => setFeatureFormData((prev) => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label htmlFor="type" className="text-[10px] uppercase text-muted-foreground font-bold">
                Type *
              </Label>
              <Select
                value={featureFormData.type}
                onValueChange={(value: FeatureType) => setFeatureFormData((prev) => ({ 
                  ...prev, 
                  type: value,
                  min: undefined,
                  max: undefined,
                  step: undefined,
                  defaultValue: undefined,
                  options: undefined
                }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {featureTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label htmlFor="status" className="text-[10px] uppercase text-muted-foreground font-bold">
                Status
              </Label>
              <Select
                value={featureFormData.status}
                onValueChange={(value: FeatureStatus) => setFeatureFormData((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="enabled" className="text-[10px] uppercase text-muted-foreground font-bold">
                Enabled by default
              </Label>
              <Switch
                id="enabled"
                checked={featureFormData.enabled}
                onCheckedChange={(checked) => setFeatureFormData((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>

            {/* Type-specific configuration */}
            {(featureFormData.type === 'slider' || featureFormData.type === 'int-slider' || featureFormData.type === 'float-slider') && (
              <div className="space-y-3 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">Slider Configuration</div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="min" className="text-[10px] uppercase text-muted-foreground font-bold">
                      Min
                    </Label>
                    <Input
                      id="min"
                      type="number"
                      className="h-8 text-sm"
                      placeholder="0"
                      value={featureFormData.min ?? ''}
                      onChange={(e) => setFeatureFormData((prev) => ({ 
                        ...prev, 
                        min: e.target.value === '' ? undefined : parseFloat(e.target.value) 
                      }))}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="max" className="text-[10px] uppercase text-muted-foreground font-bold">
                      Max
                    </Label>
                    <Input
                      id="max"
                      type="number"
                      className="h-8 text-sm"
                      placeholder="100"
                      value={featureFormData.max ?? ''}
                      onChange={(e) => setFeatureFormData((prev) => ({ 
                        ...prev, 
                        max: e.target.value === '' ? undefined : parseFloat(e.target.value) 
                      }))}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="step" className="text-[10px] uppercase text-muted-foreground font-bold">
                      Step
                    </Label>
                    <Input
                      id="step"
                      type="number"
                      className="h-8 text-sm"
                      placeholder="1"
                      value={featureFormData.step ?? ''}
                      onChange={(e) => setFeatureFormData((prev) => ({ 
                        ...prev, 
                        step: e.target.value === '' ? undefined : parseFloat(e.target.value) 
                      }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="defaultValue" className="text-[10px] uppercase text-muted-foreground font-bold">
                    Default Value
                  </Label>
                  <Input
                    id="defaultValue"
                    type="number"
                    className="h-8 text-sm"
                    placeholder="Default value"
                    value={featureFormData.defaultValue ?? ''}
                    onChange={(e) => setFeatureFormData((prev) => ({ 
                      ...prev, 
                      defaultValue: e.target.value === '' ? undefined : parseFloat(e.target.value) 
                    }))}
                  />
                </div>
              </div>
            )}

            {featureFormData.type === 'select' && (
              <div className="space-y-3 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">Select Configuration</div>
                
                <div className="space-y-1">
                  <Label htmlFor="options" className="text-[10px] uppercase text-muted-foreground font-bold">
                    Options (comma-separated) *
                  </Label>
                  <Input
                    id="options"
                    className="h-8 text-sm"
                    placeholder="option1, option2, option3"
                    value={featureFormData.options ?? ''}
                    onChange={(e) => setFeatureFormData((prev) => ({ ...prev, options: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="defaultValue" className="text-[10px] uppercase text-muted-foreground font-bold">
                    Default Value
                  </Label>
                  <Input
                    id="defaultValue"
                    className="h-8 text-sm"
                    placeholder="Default option"
                    value={featureFormData.defaultValue ?? ''}
                    onChange={(e) => setFeatureFormData((prev) => ({ ...prev, defaultValue: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {featureFormData.type === 'toggle' && (
              <div className="space-y-3 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">Toggle Configuration</div>
                
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="toggleDefault" className="text-[10px] uppercase text-muted-foreground font-bold">
                    Default State
                  </Label>
                  <Switch
                    id="toggleDefault"
                    checked={featureFormData.defaultValue === true || featureFormData.defaultValue === 'true'}
                    onCheckedChange={(checked) => setFeatureFormData((prev) => ({ ...prev, defaultValue: checked }))}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClose}
                className="h-8"
              >
                <X className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
              {editingFeature ? (
                <ConditionalRender permission="remote_control.edit" fallback={null}>
                  <Button 
                    size="sm" 
                    className="h-8" 
                    onClick={handleSave} 
                    disabled={!isFormValid}
                    title={!isFormValid ? "Please fill in all required fields" : ""}
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    Update
                  </Button>
                </ConditionalRender>
              ) : (
                <ConditionalRender permission="remote_control.create" fallback={null}>
                  <Button 
                    size="sm" 
                    className="h-8"
                    onClick={handleSave}
                    disabled={!isFormValid}
                    title={!isFormValid ? "Please fill in all required fields" : ""}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create
                  </Button>
                </ConditionalRender>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

