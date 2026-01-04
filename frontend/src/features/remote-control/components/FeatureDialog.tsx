import React, { useMemo, useCallback } from 'react'
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

// Constants
const FEATURE_TYPES: { value: FeatureType; label: string }[] = [
  { value: 'toggle', label: 'Toggle (On/Off)' },
  { value: 'int-slider', label: 'Integer Slider' },
  { value: 'float-slider', label: 'Float Slider' },
  { value: 'select', label: 'Select (Dropdown)' },
]

const STATUS_OPTIONS: { value: FeatureStatus; label: string }[] = [
  { value: 'offline', label: 'Offline' },
  { value: 'online', label: 'Online' },
  { value: 'maintenance', label: 'Maintenance' },
]

const LABEL_CLASSES = "text-[10px] uppercase text-muted-foreground font-bold"
const INPUT_CLASSES = "h-8 text-sm"
const SECTION_CLASSES = "space-y-3 pt-2 border-t"

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
  const handleClose = useCallback(() => {
    setFeatureDialogOpen(false)
    onResetFeatureForm()
  }, [setFeatureDialogOpen, onResetFeatureForm])

  const isFormValid = useMemo(() => {
    return featureFormData.name.trim().length >= 1 && 
           featureFormData.description.trim().length >= 1 &&
           featureFormData.category_id !== ''
  }, [featureFormData.name, featureFormData.description, featureFormData.category_id])

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
      <DialogContent className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">
        <DialogHeader className="px-4 py-3 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="text-sm font-semibold">
            {editingFeature ? 'Edit Feature' : 'Create Feature'}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
            {/* Name Field */}
            <div className="space-y-1">
              <Label htmlFor="name" className={LABEL_CLASSES}>
                Name *
              </Label>
              <Input
                id="name"
                className={INPUT_CLASSES}
                placeholder="e.g. Smooth Aimbot"
                value={featureFormData.name}
                onChange={(e) => setFeatureFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
                minLength={1}
              />
            </div>

            {/* Description Field */}
            <div className="space-y-1">
              <Label htmlFor="description" className={LABEL_CLASSES}>
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

            {/* Category Field */}
            <div className="space-y-1">
              <Label htmlFor="category" className={LABEL_CLASSES}>
                Category *
              </Label>
              <Select
                value={featureFormData.category_id}
                onValueChange={(value) => setFeatureFormData((prev) => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger className={INPUT_CLASSES}>
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

            {/* Type Field */}
            <div className="space-y-1">
              <Label htmlFor="type" className={LABEL_CLASSES}>
                Type *
              </Label>
              <Select value={featureFormData.type} onValueChange={handleTypeChange}>
                <SelectTrigger className={INPUT_CLASSES}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {FEATURE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Field */}
            <div className="space-y-1">
              <Label htmlFor="status" className={LABEL_CLASSES}>
                Status
              </Label>
              <Select
                value={featureFormData.status}
                onValueChange={(value: FeatureStatus) => setFeatureFormData((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger className={INPUT_CLASSES}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enabled Field */}
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="enabled" className={LABEL_CLASSES}>
                Enabled by default
              </Label>
              <Switch
                id="enabled"
                checked={featureFormData.enabled}
                onCheckedChange={(checked) => setFeatureFormData((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>

            {/* Type-specific Configuration */}
            {isSliderType && (
              <div className={SECTION_CLASSES}>
                <div className="text-xs font-medium text-muted-foreground">Slider Configuration</div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="min" className={LABEL_CLASSES}>Min</Label>
                    <Input
                      id="min"
                      type="number"
                      className={INPUT_CLASSES}
                      placeholder="0"
                      value={featureFormData.min ?? ''}
                      onChange={handleNumberChange('min')}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="max" className={LABEL_CLASSES}>Max</Label>
                    <Input
                      id="max"
                      type="number"
                      className={INPUT_CLASSES}
                      placeholder="100"
                      value={featureFormData.max ?? ''}
                      onChange={handleNumberChange('max')}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="step" className={LABEL_CLASSES}>Step</Label>
                    <Input
                      id="step"
                      type="number"
                      className={INPUT_CLASSES}
                      placeholder="1"
                      value={featureFormData.step ?? ''}
                      onChange={handleNumberChange('step')}
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="defaultValue" className={LABEL_CLASSES}>Default Value</Label>
                  <Input
                    id="defaultValue"
                    type="number"
                    className={INPUT_CLASSES}
                    placeholder="Default value"
                    value={featureFormData.defaultValue ?? ''}
                    onChange={handleNumberChange('defaultValue')}
                  />
                </div>
              </div>
            )}

            {featureFormData.type === 'select' && (
              <div className={SECTION_CLASSES}>
                <div className="text-xs font-medium text-muted-foreground">Select Configuration</div>
                
                <div className="space-y-1">
                  <Label htmlFor="options" className={LABEL_CLASSES}>
                    Options (comma-separated) *
                  </Label>
                  <Input
                    id="options"
                    className={INPUT_CLASSES}
                    placeholder="option1, option2, option3"
                    value={featureFormData.options ?? ''}
                    onChange={(e) => setFeatureFormData((prev) => ({ ...prev, options: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="selectDefaultValue" className={LABEL_CLASSES}>Default Value</Label>
                  <Input
                    id="selectDefaultValue"
                    className={INPUT_CLASSES}
                    placeholder="Default option"
                    value={featureFormData.defaultValue ?? ''}
                    onChange={(e) => setFeatureFormData((prev) => ({ ...prev, defaultValue: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {featureFormData.type === 'toggle' && (
              <div className={SECTION_CLASSES}>
                <div className="text-xs font-medium text-muted-foreground">Toggle Configuration</div>
                
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="toggleDefault" className={LABEL_CLASSES}>Default State</Label>
                  <Switch
                    id="toggleDefault"
                    checked={featureFormData.defaultValue === true}
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

