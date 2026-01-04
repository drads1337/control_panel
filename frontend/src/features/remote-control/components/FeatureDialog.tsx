import React, { useMemo, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render'
import type { RemoteFeature } from '@/shared/lib/remote-control-api'
import type { RemoteCategory } from '../category'
import type { FeatureFormData, FeatureType, FeatureStatus } from '../hooks/use-remote-control-logic'

export type { FeatureType, FeatureStatus, FeatureFormData }

// Constants
const FEATURE_TYPES: { value: FeatureType; label: string }[] = [
  { value: 'toggle', label: 'Toggle' }, // Сократил лейблы для компактности
  { value: 'int-slider', label: 'Int Slider' },
  { value: 'float-slider', label: 'Float Slider' },
  { value: 'select', label: 'Select' },
]

const STATUS_OPTIONS: { value: FeatureStatus; label: string }[] = [
  { value: 'offline', label: 'Offline' },
  { value: 'online', label: 'Online' },
  { value: 'maintenance', label: 'Maint.' }, // Сократил для компактности
]

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
  categoryId?: string // Optional: if provided, category is fixed and not editable
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
  onResetFeatureForm,
  categoryId
}: FeatureDialogProps) {
  // Ensure category_id is set when categoryId prop is provided
  useEffect(() => {
    if (categoryId && featureFormData.category_id !== categoryId) {
      setFeatureFormData((prev) => ({ ...prev, category_id: categoryId }))
    }
  }, [categoryId, featureFormData.category_id, setFeatureFormData])

  const handleClose = useCallback(() => {
    setFeatureDialogOpen(false)
    onResetFeatureForm()
  }, [setFeatureDialogOpen, onResetFeatureForm])

  const isFormValid = useMemo(() => {
    const hasCategory = categoryId ? true : featureFormData.category_id !== ''
    return featureFormData.name.trim().length >= 1 && 
           featureFormData.description.trim().length >= 1 &&
           hasCategory
  }, [featureFormData.name, featureFormData.description, featureFormData.category_id, categoryId])

  const handleSave = useCallback(() => {
    if (editingFeature) {
      onUpdateFeature()
    } else {
      onAddFeature()
    }
  }, [editingFeature, onUpdateFeature, onAddFeature])

  const handleTypeChange = useCallback((value: FeatureType) => {
    setFeatureFormData((prev) => ({ 
      ...prev, 
      type: value,
      min: undefined,
      max: undefined,
      step: undefined,
      defaultValue: undefined,
      options: undefined
    }))
  }, [setFeatureFormData])

  const handleNumberChange = useCallback((field: 'min' | 'max' | 'step' | 'defaultValue') => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFeatureFormData((prev) => ({ 
        ...prev, 
        [field]: e.target.value === '' ? undefined : parseFloat(e.target.value) 
      }))
    }
  }, [setFeatureFormData])

  const isSliderType = useMemo(() => {
    return featureFormData.type === 'int-slider' || 
           featureFormData.type === 'float-slider'
  }, [featureFormData.type])

  return (
    <Dialog open={featureDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              {editingFeature ? 'Edit Feature' : 'Create Feature'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingFeature ? 'Edit feature settings.' : 'Create a new feature.'}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="space-y-4">
            {/* Name Field */}
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs font-medium">Name *</Label>
              <Input
                id="name"
                className="h-8 text-xs"
                placeholder="Feature Name"
                value={featureFormData.name}
                onChange={(e) => setFeatureFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            {/* Description Field */}
            <div className="space-y-1">
              <Label htmlFor="description" className="text-xs font-medium">Description *</Label>
              <Textarea
                id="description"
                className="min-h-[60px] text-xs"
                placeholder="Description..."
                value={featureFormData.description}
                onChange={(e) => setFeatureFormData((prev) => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>

            {/* --- ГРУППИРОВКА В ОДНУ СТРОКУ (GRID) --- */}
            <div className="grid grid-cols-2 gap-3">
              {/* Type Field */}
              <div className="space-y-1">
                <Label htmlFor="type" className="text-xs font-medium">Type *</Label>
                <Select value={featureFormData.type} onValueChange={handleTypeChange}>
                  <SelectTrigger className="h-8 text-xs px-2">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {FEATURE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="text-xs">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Field */}
              <div className="space-y-1">
                <Label htmlFor="status" className="text-xs font-medium">Status</Label>
                <Select
                  value={featureFormData.status}
                  onValueChange={(value: FeatureStatus) => setFeatureFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="h-8 text-xs px-2">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value} className="text-xs">
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* ------------------------------------------- */}

           
            {/* Type-specific Configuration */}
            {isSliderType && (
              <div className="space-y-3 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">Slider Config</div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Min</Label>
                    <Input type="number" className="h-7 text-xs" placeholder="0"
                      value={featureFormData.min ?? ''} onChange={handleNumberChange('min')} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Max</Label>
                    <Input type="number" className="h-7 text-xs" placeholder="100"
                      value={featureFormData.max ?? ''} onChange={handleNumberChange('max')} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Step</Label>
                    <Input type="number" className="h-7 text-xs" placeholder="1"
                      value={featureFormData.step ?? ''} onChange={handleNumberChange('step')} />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Default Value</Label>
                  <Input type="number" className="h-8 text-xs" placeholder="Default"
                    value={typeof featureFormData.defaultValue === 'number' ? featureFormData.defaultValue : (typeof featureFormData.defaultValue === 'string' ? parseFloat(featureFormData.defaultValue) || '' : '')} onChange={handleNumberChange('defaultValue')} />
                </div>
              </div>
            )}

            {featureFormData.type === 'select' && (
              <div className="space-y-3 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">Select Config</div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Options (comma-separated)</Label>
                  <Input className="h-8 text-xs" placeholder="opt1, opt2"
                    value={featureFormData.options ?? ''}
                    onChange={(e) => setFeatureFormData((prev) => ({ ...prev, options: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Default Value</Label>
                  <Input className="h-8 text-xs" placeholder="Default option"
                    value={typeof featureFormData.defaultValue === 'string' ? featureFormData.defaultValue : (typeof featureFormData.defaultValue === 'number' ? String(featureFormData.defaultValue) : '')}
                    onChange={(e) => setFeatureFormData((prev) => ({ ...prev, defaultValue: e.target.value }))} />
                </div>
              </div>
            )}

            {featureFormData.type === 'toggle' && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggleDefault" className="text-xs font-medium">Default State (On/Off)</Label>
                  <Switch id="toggleDefault" className="scale-90"
                    checked={featureFormData.defaultValue === true}
                    onCheckedChange={(checked) => setFeatureFormData((prev) => ({ ...prev, defaultValue: checked }))} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 pt-2 border-t bg-muted/5">
          <Button type="button" variant="ghost" onClick={handleClose} className="h-8 text-xs">
            Cancel
          </Button>
          
          <ConditionalRender permission={editingFeature ? "remote_control.edit" : "remote_control.create"} fallback={null}>
            <Button type="button" onClick={handleSave} disabled={!isFormValid} className="h-8 text-xs px-4">
              {editingFeature ? 'Save Changes' : 'Create Feature'}
            </Button>
          </ConditionalRender>
        </div>
      </DialogContent>
    </Dialog>
  )
}