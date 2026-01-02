import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render'
import { BLOCK_TYPE_OPTIONS, BLOCK_CATEGORY_OPTIONS, SEVERITY_OPTIONS } from '@/shared/constants/filters'
import { useBlockDialogConfig } from '../hooks/useBlockDialogConfig'

interface AddIPBlockProps {
  onAdd: (data: {
    ip_address: string
    reason: string
    expires_at?: string
    block_type: string
    category: string
    severity: string
    threat_score: number
  }) => void
  loading?: boolean
}

export default function AddIPBlock({ onAdd, loading = false }: AddIPBlockProps) {
  const config = useBlockDialogConfig('ip')
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    ip_address: '',
    reason: '',
    block_type: 'manual',
    category: 'general',
    severity: 'medium',
    threat_score: 50
  })
  const [expiresDate, setExpiresDate] = useState<Date | undefined>(undefined)

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const resetForm = () => {
    setFormData({
      ip_address: '',
      reason: '',
      block_type: 'manual',
      category: 'general',
      severity: 'medium',
      threat_score: 50
    })
    setExpiresDate(undefined)
  }

  const isValid = formData.ip_address.trim() && formData.reason.trim() && 
    formData.threat_score >= 0 && formData.threat_score <= 100

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValid) {
      return
    }

    onAdd({
      ip_address: formData.ip_address,
      reason: formData.reason,
      expires_at: expiresDate 
        ? format(expiresDate, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'') 
        : undefined,
      block_type: formData.block_type,
      category: formData.category,
      severity: formData.severity,
      threat_score: formData.threat_score
    })
    
    resetForm()
    setOpen(false)
  }

  const blockTypeOptions = config.blockTypeOptions || BLOCK_TYPE_OPTIONS
  const categoryOptions = config.categoryOptions || BLOCK_CATEGORY_OPTIONS
  const isGridLayout = config.fieldLayout === 'grid'

  return (
    <ConditionalRender permission={config.permission} fallback={null}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            size="sm" 
            disabled={loading}
            className="h-8 text-xs"
          >
            <Plus className="h-4 w-4 mr-2" />
            {config.buttonText}
          </Button>
        </DialogTrigger>
        <DialogContent className={cn(
          "w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden",
          config.dialogMaxWidth
        )}>
          <DialogHeader className="p-4 pb-1 bg-muted/5">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold">{config.title}</DialogTitle>
              <DialogDescription className="text-xs">
                {config.description}
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-4">
            <div className={cn(isGridLayout ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-4")}>
              <div className="space-y-2">
                <Label htmlFor={config.fieldName} className="text-xs font-medium">{config.fieldLabel} *</Label>
                <Input
                  id={config.fieldName}
                  placeholder={config.fieldPlaceholder}
                  value={formData.ip_address}
                  onChange={(e) => handleInputChange('ip_address', e.target.value)}
                  required
                  className="h-8 text-xs"
                />
              </div>

              {isGridLayout && (
                <div className="space-y-2">
                  <Label htmlFor="block_type" className="text-xs font-medium">Block Type</Label>
                  <Select 
                    value={formData.block_type} 
                    onValueChange={(value) => handleInputChange('block_type', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {blockTypeOptions.map((option: { value: string; label: string }) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-xs font-medium">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for blocking..."
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                required
                rows={3}
                className="text-xs min-h-[60px]"
              />
            </div>

            {!isGridLayout && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="block_type" className="text-xs font-medium">Block Type</Label>
                  <Select 
                    value={formData.block_type} 
                    onValueChange={(value) => handleInputChange('block_type', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {blockTypeOptions.map((option: { value: string; label: string }) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-xs font-medium">Category</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => handleInputChange('category', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {categoryOptions.map((option: { value: string; label: string }) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isGridLayout && (
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-xs font-medium">Category</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => handleInputChange('category', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {categoryOptions.map((option: { value: string; label: string }) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="severity" className="text-xs font-medium">Severity</Label>
                <Select 
                  value={formData.severity} 
                  onValueChange={(value) => handleInputChange('severity', value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {SEVERITY_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="threat_score" className="text-xs font-medium">Threat Score (0-100)</Label>
                <Input
                  id="threat_score"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.threat_score}
                  onChange={(e) => handleInputChange('threat_score', parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>

              {isGridLayout && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Expiration Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-8 text-xs",
                          !expiresDate && "text-muted-foreground"
                        )}
                      >
                        {expiresDate ? format(expiresDate, "PPP") : "No expiration"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={expiresDate}
                        onSelect={setExpiresDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {!isGridLayout && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Expiration Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-8 text-xs",
                        !expiresDate && "text-muted-foreground"
                      )}
                    >
                      {expiresDate ? format(expiresDate, "PPP") : "No expiration"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiresDate}
                      onSelect={setExpiresDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 pt-2 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                disabled={loading}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !isValid}
                className="h-8 text-xs min-w-[80px]"
              >
                {loading ? (
                  <Spinner className="size-3" />
                ) : (
                  config.submitButtonText
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </ConditionalRender>
  )
}