import React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { BlockFormData } from '../AddBlockDialog'
import { BLOCK_TYPE_OPTIONS, BLOCK_CATEGORY_OPTIONS, SEVERITY_OPTIONS } from '@/shared/constants'

interface BlockFormFieldsProps {
  config: {
    fieldName: string
    fieldLabel: string
    fieldPlaceholder: string
    fieldLayout?: 'single' | 'grid'
    blockTypeOptions?: Array<{ value: string; label: string }>
    categoryOptions?: Array<{ value: string; label: string }>
  }
  formData: BlockFormData
  expiresDate: Date | undefined
  onInputChange: (field: string, value: string | number) => void
  onExpiresDateChange: (date: Date | undefined) => void
}

export function BlockFormFields({
  config,
  formData,
  expiresDate,
  onInputChange,
  onExpiresDateChange,
}: BlockFormFieldsProps) {
  const blockTypeOptions = config.blockTypeOptions || BLOCK_TYPE_OPTIONS
  const categoryOptions = config.categoryOptions || BLOCK_CATEGORY_OPTIONS
  const fieldValue = formData[config.fieldName] as string
  const isGridLayout = config.fieldLayout === 'grid'

  return (
    <>
      {/* Main field and block type - grid layout when fieldLayout is 'grid' */}
      <div className={cn(isGridLayout ? "grid grid-cols-2 gap-4" : "space-y-4")}>
        <div className="space-y-2">
          <Label htmlFor={config.fieldName}>{config.fieldLabel} *</Label>
          <Input
            id={config.fieldName}
            placeholder={config.fieldPlaceholder}
            value={fieldValue}
            onChange={(e) => onInputChange(config.fieldName, e.target.value)}
            required
          />
        </div>
        
        {isGridLayout && (
          <div className="space-y-2">
            <Label htmlFor="block_type">Block Type</Label>
            <Select value={formData.block_type as string} onValueChange={(value) => onInputChange('block_type', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {blockTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Reason field */}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason *</Label>
        <Textarea
          id="reason"
          placeholder="Enter the reason for blocking..."
          value={formData.reason as string}
          onChange={(e) => onInputChange('reason', e.target.value)}
          required
          rows={3}
        />
      </div>

      {/* Block type and category - shown after reason when fieldLayout is 'single' */}
      {!isGridLayout && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="block_type">Block Type</Label>
            <Select value={formData.block_type as string} onValueChange={(value) => onInputChange('block_type', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {blockTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category as string} onValueChange={(value) => onInputChange('category', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Category and severity - grid layout */}
      <div className="grid grid-cols-2 gap-4">
        {isGridLayout && (
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category as string} onValueChange={(value) => onInputChange('category', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="severity">Severity</Label>
          <Select value={formData.severity as string} onValueChange={(value) => onInputChange('severity', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Threat score and expiration - grid layout */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="threat_score">Threat Score (0-100)</Label>
          <Input
            id="threat_score"
            type="number"
            min="0"
            max="100"
            value={formData.threat_score}
            onChange={(e) => onInputChange('threat_score', parseInt(e.target.value) || 0)}
          />
        </div>

        {isGridLayout && (
          <div className="space-y-2">
            <Label>Expiration Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiresDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiresDate ? format(expiresDate, "PPP") : "No expiration"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiresDate}
                  onSelect={onExpiresDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Expiration date - full width when fieldLayout is 'single' */}
      {!isGridLayout && (
        <div className="space-y-2">
          <Label>Expiration Date (Optional)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !expiresDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {expiresDate ? format(expiresDate, "PPP") : "No expiration"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={expiresDate}
                onSelect={onExpiresDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </>
  )
}

