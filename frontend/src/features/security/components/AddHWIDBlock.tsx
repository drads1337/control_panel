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
import { cn } from '@/lib/utils.ts'
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render'
import { BLOCK_TYPE_OPTIONS, BLOCK_CATEGORY_OPTIONS, SEVERITY_OPTIONS } from '@/shared/constants/filters'

interface AddHWIDBlockProps {
  onAdd: (data: {
    hwid: string
    reason: string
    expires_at?: string
    block_type: string
    category: string
    severity: string
    threat_score: number
  }) => void
  loading?: boolean
}

export default function AddHWIDBlock({ onAdd, loading = false }: AddHWIDBlockProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    hwid: '',
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
      hwid: '',
      reason: '',
      block_type: 'manual',
      category: 'general',
      severity: 'medium',
      threat_score: 50
    })
    setExpiresDate(undefined)
  }

  const isValid = formData.hwid.trim() && formData.reason.trim() && 
    formData.threat_score >= 0 && formData.threat_score <= 100

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValid) {
      return
    }

    onAdd({
      hwid: formData.hwid,
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

  return (
    <ConditionalRender permission="security.block_hwids" fallback={null}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            size="sm" 
            disabled={loading}
            className="h-8 text-xs"
          >
            <Plus className="h-4 w-4 mr-2" />
            Block HWID
          </Button>
        </DialogTrigger>
        <DialogContent className={cn(
          "w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden"
        )}>
          <DialogHeader className="p-4 pb-1 bg-muted/5">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold">Block Hardware ID</DialogTitle>
              <DialogDescription className="text-xs">
                Add a new hardware ID to the block list. This will prevent the device from accessing your system.
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hwid" className="text-xs font-medium">Hardware ID *</Label>
              <Input
                id="hwid"
                placeholder="HWID-ABC123-DEF456-GHI789"
                value={formData.hwid}
                onChange={(e) => handleInputChange('hwid', e.target.value)}
                required
                className="h-8 text-xs"
              />
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
                    {BLOCK_TYPE_OPTIONS.map(option => (
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
                    {BLOCK_CATEGORY_OPTIONS.map(option => (
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
            </div>

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
                  'Block HWID'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </ConditionalRender>
  )
}

