"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useWebhookActions } from '../hooks/use-webhook-actions'
import { WEBHOOK_EVENTS } from '../constants'
import type { WebhookFormData, WebhookData } from '../types'
import { Eye, EyeOff, Plus, X } from 'lucide-react'

interface EditWebhookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingWebhook: WebhookData | null
  formData: WebhookFormData
  setFormData: (data: WebhookFormData) => void
  customHeaders: Array<{ key: string, value: string }>
  setCustomHeaders: (headers: Array<{ key: string, value: string }>) => void
  secretsVisibility: {
    createTelegramToken: boolean
    createDiscordToken: boolean
    createSecret: boolean
    editTelegramToken: boolean
    editDiscordToken: boolean
    editSecret: boolean
  }
  setSecretsVisibility: (visibility: {
    createTelegramToken: boolean
    createDiscordToken: boolean
    createSecret: boolean
    editTelegramToken: boolean
    editDiscordToken: boolean
    editSecret: boolean
  }) => void
  originalWebhookData: WebhookData | null
  onSuccess?: () => void
}

export function EditWebhookDialog({
  open,
  onOpenChange,
  editingWebhook,
  formData,
  setFormData,
  customHeaders,
  setCustomHeaders,
  secretsVisibility,
  setSecretsVisibility,
  originalWebhookData,
  onSuccess
}: EditWebhookDialogProps) {
  const { handleEditWebhook } = useWebhookActions()
  const [updating, setUpdating] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState<string[]>(formData.events || [])

  useEffect(() => {
    setSelectedEvents(formData.events || [])
  }, [formData.events])

  if (!editingWebhook) {
    return null
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Webhook name is required')
      return
    }

    if (formData.webhook_type === 'custom' && !formData.url.trim()) {
      toast.error('URL is required for custom webhooks')
      return
    }

    if (formData.webhook_type === 'telegram' && (!formData.telegram_bot_token || !formData.telegram_chat_id)) {
      toast.error('Telegram bot token and chat ID are required')
      return
    }

    if (formData.webhook_type === 'discord' && (!formData.discord_webhook_url)) {
      toast.error('Discord webhook URL is required')
      return
    }

    if (selectedEvents.length === 0) {
      toast.error('Please select at least one event')
      return
    }

    try {
      setUpdating(true)
      const success = await handleEditWebhook(
        editingWebhook.id,
        { ...formData, events: selectedEvents },
        customHeaders,
        originalWebhookData
      )

      if (success) {
        onOpenChange(false)
        onSuccess?.()
      }
    } catch (error) {
      console.error('Error updating webhook:', error)
    } finally {
      setUpdating(false)
    }
  }

  const toggleEvent = (eventName: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventName)
        ? prev.filter(e => e !== eventName)
        : [...prev, eventName]
    )
  }

  const addHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }])
  }

  const removeHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders]
    updated[index] = { ...updated[index], [field]: value }
    setCustomHeaders(updated)
  }

  const eventsByCategory = WEBHOOK_EVENTS.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = []
    }
    acc[event.category].push(event)
    return acc
  }, {} as Record<string, typeof WEBHOOK_EVENTS>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">Edit Webhook</DialogTitle>
            <DialogDescription className="text-xs">
              Update webhook configuration for "{editingWebhook.name}"
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Basic Info */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-medium">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Webhook"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="webhook_type" className="text-xs font-medium">Type *</Label>
            <Select
              value={formData.webhook_type}
              onValueChange={(value: 'custom' | 'telegram' | 'discord') => 
                setFormData({ ...formData, webhook_type: value })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom URL</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom URL */}
          {formData.webhook_type === 'custom' && (
            <div className="space-y-1.5">
              <Label htmlFor="url" className="text-xs font-medium">URL *</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com/webhook"
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* Telegram Configuration */}
          {formData.webhook_type === 'telegram' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="telegram_bot_token" className="text-xs font-medium">Bot Token *</Label>
                <div className="flex gap-1">
                  <Input
                    id="telegram_bot_token"
                    type={secretsVisibility.editTelegramToken ? "text" : "password"}
                    value={formData.telegram_bot_token}
                    onChange={(e) => setFormData({ ...formData, telegram_bot_token: e.target.value })}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    className="flex-1 h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSecretsVisibility({ ...secretsVisibility, editTelegramToken: !secretsVisibility.editTelegramToken })}
                    className="h-8 w-8 p-0"
                  >
                    {secretsVisibility.editTelegramToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telegram_chat_id" className="text-xs font-medium">Chat ID *</Label>
                <Input
                  id="telegram_chat_id"
                  value={formData.telegram_chat_id}
                  onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                  placeholder="123456789"
                  className="h-8 text-xs"
                />
              </div>
            </>
          )}

          {/* Discord Configuration */}
          {formData.webhook_type === 'discord' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="discord_webhook_url" className="text-xs font-medium">Webhook URL *</Label>
                <Input
                  id="discord_webhook_url"
                  type="url"
                  value={formData.discord_webhook_url}
                  onChange={(e) => setFormData({ ...formData, discord_webhook_url: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="h-8 text-xs"
                />
              </div>
            </>
          )}

          {/* Custom Secret */}
          {formData.webhook_type === 'custom' && (
            <div className="space-y-1.5">
              <Label htmlFor="secret" className="text-xs font-medium">Signing Secret</Label>
              <div className="flex gap-1">
                <Input
                  id="secret"
                  type={secretsVisibility.editSecret ? "text" : "password"}
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder="Leave empty to keep current secret"
                  className="flex-1 h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSecretsVisibility({ ...secretsVisibility, editSecret: !secretsVisibility.editSecret })}
                  className="h-8 w-8 p-0"
                >
                  {secretsVisibility.editSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          )}

          {/* Custom Headers */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Custom Headers</Label>
              <Button
                type="button"
                variant="outline"
                onClick={addHeader}
                className="h-8 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Header
              </Button>
            </div>
            {customHeaders.map((header, index) => (
              <div key={index} className="flex gap-1">
                <Input
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
                <Input
                  placeholder="Header value"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeHeader(index)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Events */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Events *</Label>
            <ScrollArea className="h-[200px] w-full border rounded-md p-3">
              <div className="space-y-3">
                {Object.entries(eventsByCategory).map(([category, events]) => (
                  <div key={category}>
                    <h4 className="font-semibold text-xs mb-1.5">{category}</h4>
                    <div className="space-y-1.5">
                      {events.map((event) => (
                        <div key={event.name} className="flex items-start space-x-2">
                          <Checkbox
                            id={`event-${event.name}`}
                            checked={selectedEvents.includes(event.name)}
                            onCheckedChange={() => toggleEvent(event.name)}
                            className="mt-0.5"
                          />
                          <Label
                            htmlFor={`event-${event.name}`}
                            className="cursor-pointer font-normal text-xs leading-relaxed"
                          >
                            {event.name}
                            <span className="text-muted-foreground ml-1.5">- {event.description}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-3" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
            />
            <Label htmlFor="is_active" className="cursor-pointer text-xs">
              Active (webhook will receive events)
            </Label>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={updating}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={updating}
              className="h-8 text-xs min-w-[80px]"
            >
              {updating ? 'Updating...' : 'Update Webhook'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
