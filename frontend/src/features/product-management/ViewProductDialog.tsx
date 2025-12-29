"use client"

import * as React from "react"
import { useState, useEffect } from "react"
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

import { usePermissions } from '@/shared/hooks/use-permissions'
import { extendLicenseKey, updateLicenseKey } from '@/entities/key'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import type { LicenseKey } from '@/entities/key'
import { durationOptions } from './hooks/use-duration'

interface KeyEditExtendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyData: LicenseKey | null
  onSuccess: () => void
  initialTab?: 'edit' | 'extend'
}

export default function KeyEditExtendDialog({ 
  open, 
  onOpenChange, 
  keyData, 
  onSuccess,
  initialTab = 'extend'
}: KeyEditExtendDialogProps) {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('keys.edit')
  const canExtend = hasPermission('keys.extend')

  // Determine available tabs
  const showEdit = canEdit
  const showExtend = canExtend
  const showTabsUI = showEdit && showExtend

  const [activeTab, setActiveTab] = useState<'edit' | 'extend'>(initialTab)
  const [loading, setLoading] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState({ max_devices: 1, notes: '' })

  // Extend form state
  const [extendType, setExtendType] = useState<'duration' | 'hours'>('duration')
  const [customHours, setCustomHours] = useState('')
  const [selectedDuration, setSelectedDuration] = useState('24')

  // Reset state on open
  useEffect(() => {
    if (open && keyData) {
      // Logic to fallback if the requested tab isn't allowed
      let effectiveTab = initialTab
      if (initialTab === 'edit' && !showEdit && showExtend) effectiveTab = 'extend'
      if (initialTab === 'extend' && !showExtend && showEdit) effectiveTab = 'edit'
      
      setActiveTab(effectiveTab)

      setEditForm({
        max_devices: keyData.max_devices || 1,
        notes: '' // If notes exist on keyData, map them here: keyData.notes || ''
      })
      setExtendType('duration')
      setCustomHours('')
      setSelectedDuration('24')
    }
  }, [open, keyData, initialTab, showEdit, showExtend])

  const getTotalHours = () => {
    return extendType === 'hours' ? (parseInt(customHours) || 0) : (parseInt(selectedDuration) || 0)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyData || !canEdit) return

    setLoading(true)
    try {
      await updateLicenseKey(keyData.id, { max_devices: editForm.max_devices })
      toast.success('License key updated successfully')
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to update license key')
    } finally {
      setLoading(false)
    }
  }

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyData || !canExtend) return

    const hours = getTotalHours()
    if (hours <= 0) { toast.error('Invalid duration'); return }
    if (hours > 8760) { toast.error('Maximum duration is 1 year (8760 hours)'); return }

    setLoading(true)
    try {
      await extendLicenseKey(keyData.id, hours)
      toast.success(`License extended by ${hours} hours`)
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to extend license key')
    } finally {
      setLoading(false)
    }
  }

  if (!keyData || (!showEdit && !showExtend)) return null

  // Calculation vars for the extend tab
  const currentDuration = keyData.duration_hours || 0
  const addedHours = getTotalHours()
  const newTotal = currentDuration + addedHours

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[440px] p-0 gap-0 overflow-hidden bg-background">
        
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b bg-muted/5">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            Manage License
          </DialogTitle>
          <DialogDescription className="text-xs">
            Modifying settings for key <span className="font-mono text-foreground font-medium">#{keyData.id}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as 'edit' | 'extend')} 
          className="flex-1 flex flex-col min-h-0 w-full"
        >
          {showTabsUI && (
            <div className="border-b px-4">
              <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none gap-6">
                <TabsTrigger 
                  value="extend"
                  className="rounded-none border-b-2 border-transparent px-0 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  Extend Duration
                </TabsTrigger>
                <TabsTrigger 
                  value="edit" 
                  className="rounded-none border-b-2 border-transparent px-0 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  Edit Details
                </TabsTrigger>
              </TabsList>
            </div>
          )}

          <div className="p-4">
            {/* --- EXTEND TAB --- */}
            <TabsContent value="extend" className="mt-0 space-y-5 focus-visible:outline-none">
              <form onSubmit={handleExtendSubmit} className="space-y-5">
                
                {/* Current Status Banner */}
                <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-900/50">
                   <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Current Duration</span>
                   <Badge variant="secondary" className="font-mono text-xs bg-background/60 hover:bg-background/80">
                      {currentDuration} hrs
                   </Badge>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Extension Method</Label>
                    <ToggleGroup
                      type="single"
                      value={extendType}
                      onValueChange={(val) => val && setExtendType(val as 'duration' | 'hours')}
                      className="justify-start w-full gap-2"
                    >
                      <ToggleGroupItem value="duration" className="flex-1 h-8 text-xs border bg-background hover:bg-muted data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                        Preset
                      </ToggleGroupItem>
                      <ToggleGroupItem value="hours" className="flex-1 h-8 text-xs border bg-background hover:bg-muted data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                        Custom
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {extendType === 'duration' ? (
                    <div className="grid grid-cols-4 gap-2">
                      {durationOptions.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={selectedDuration === option.hours.toString() ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedDuration(option.hours.toString())}
                          disabled={loading}
                          className="text-xs h-9 w-full"
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        type="number"
                        value={customHours}
                        onChange={(e) => setCustomHours(e.target.value)}
                        placeholder="e.g. 48"
                        min="1"
                        max="8760"
                        disabled={loading}
                        className="h-9 font-mono"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">hours</span>
                    </div>
                  )}
                </div>

                {/* Summary Card */}
                <Card size="sm" className="bg-muted/30 border-dashed">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Original</span>
                        <span className="font-mono">{currentDuration}h</span>
                      </div>
                      <span className="text-muted-foreground/50 text-lg">+</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Adding</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-500">+{addedHours}h</span>
                      </div>
                      <span className="text-muted-foreground/50 text-lg">=</span>
                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-muted-foreground">New Total</span>
                        <span className="font-mono font-bold text-foreground">{newTotal}h</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-3 pt-2">
                   <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="h-9 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || addedHours <= 0} className="h-9 text-xs min-w-[80px]">
                    {loading ? <Spinner className="size-3" /> : 'Confirm Extension'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* --- EDIT TAB --- */}
            <TabsContent value="edit" className="mt-0 space-y-5 focus-visible:outline-none">
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="max_devices" className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
                      Max Devices
                    </Label>
                    <Input
                      id="max_devices"
                      type="number"
                      value={editForm.max_devices}
                      onChange={(e) => setEditForm(p => ({ ...p, max_devices: parseInt(e.target.value) || 1 }))}
                      min="1"
                      required
                      disabled={loading}
                      className="h-9"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      The number of unique hardware IDs allowed for this license.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
                      Internal Notes
                    </Label>
                    <Textarea
                      id="notes"
                      value={editForm.notes}
                      onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Add administrative notes here..."
                      rows={4}
                      disabled={loading}
                      className="resize-none w-full min-h-[100px]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="h-9 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="h-9 text-xs min-w-[80px]">
                    {loading ? <Spinner className="size-3" /> : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}