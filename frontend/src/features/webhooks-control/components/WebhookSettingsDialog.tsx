"use client"

import React, { useState } from 'react'
import { 
  Copy, 
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { WebhookData } from '../types'

interface WebhookSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  webhook: WebhookData | null
  onEdit?: () => void
  onDelete?: () => void
}

export function WebhookSettingsDialog({
  open,
  onOpenChange,
  webhook,
  onEdit,
  onDelete
}: WebhookSettingsDialogProps) {
  const [secretVisible, setSecretVisible] = useState(false)

  if (!webhook) return null

  const handleCopyUrl = () => {
    if (webhook.url) {
      navigator.clipboard.writeText(webhook.url)
      toast.success('URL copied to clipboard')
    }
  }

  const handleCopySecret = () => {
    if (webhook.secret) {
      navigator.clipboard.writeText(webhook.secret)
      toast.success('Secret copied to clipboard')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              {webhook.name} - Settings
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure webhook endpoint settings, manage signing secrets, and view subscribed events.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="space-y-3">
            {webhook.webhook_type === 'custom' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Endpoint URL</Label>
                <div className="flex gap-1">
                  <Input 
                    type="text" 
                    value={webhook.url || ''} 
                    readOnly
                    className="flex-1 font-mono text-xs h-8" 
                  />
                  {webhook.url && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyUrl}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Input 
                type="text" 
                value={webhook.name} 
                readOnly
                className="w-full text-xs h-8" 
              />
            </div>
          </div>

          {/* Signing Secret */}
          {webhook.secret && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Signing Secret</Label>
              <div className="flex gap-1">
                <Input 
                  type={secretVisible ? "text" : "password"} 
                  value={webhook.secret} 
                  readOnly 
                  className="flex-1 font-mono text-xs h-8" 
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSecretVisible(!secretVisible)}
                  className="h-8 w-8 p-0"
                >
                  {secretVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopySecret}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Subscriptions */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Subscribed Events</Label>
            <div className="space-y-1">
              {webhook.events.length > 0 ? (
                webhook.events.map(evt => (
                  <div 
                    key={evt} 
                    className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-md text-xs"
                  >
                    <span className="font-mono text-foreground">{evt}</span>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 rounded-md">No events subscribed. Edit the webhook to add events.</div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="px-3 py-2 border border-destructive/50 bg-destructive/10 rounded-md flex items-center justify-between">
            <div>
              <h4 className="text-xs font-medium text-destructive">Delete Endpoint</h4>
              <p className="text-[10px] text-destructive/70 mt-0.5">Permanently delete this webhook endpoint. This action cannot be undone.</p>
            </div>
            <Button
              variant="destructive"
              onClick={onDelete}
              className="h-8 text-xs"
            >
              Delete
            </Button>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Close
            </Button>
            {onEdit && (
              <Button 
                variant="outline"
                onClick={onEdit}
                className="h-8 text-xs"
              >
                Edit Webhook
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
