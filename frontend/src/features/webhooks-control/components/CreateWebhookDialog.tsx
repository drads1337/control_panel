"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import type { WebhookFormData } from '../types'
import { Eye, EyeOff, Plus, X } from 'lucide-react'

interface CreateWebhookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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
  onSuccess?: () => void
}

export function CreateWebhookDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  customHeaders,
  setCustomHeaders,
  secretsVisibility,
  setSecretsVisibility,
  onSuccess
}: CreateWebhookDialogProps) {
  const { handleCreateWebhook } = useWebhookActions()
  const [creating, setCreating] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState<string[]>(formData.events || [])

  useEffect(() => {
    setSelectedEvents(formData.events || [])
  }, [formData.events])

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
      setCreating(true)
      const success = await handleCreateWebhook(
        { ...formData, events: selectedEvents },
        customHeaders
      )

      if (success) {
        onOpenChange(false)
        onSuccess?.()
      }
    } catch (error) {
      console.error('Error creating webhook:', error)
    } finally {
      setCreating(false)
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
          <DialogDescription>
            Create a new webhook endpoint to receive events
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Info */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Webhook"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_type">Type *</Label>
            <Select
              value={formData.webhook_type}
              onValueChange={(value: 'custom' | 'telegram' | 'discord') => 
                setFormData({ ...formData, webhook_type: value })
              }
            >
              <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="url">URL *</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com/webhook"
              />
            </div>
          )}

          {/* Telegram Fields */}
          {formData.webhook_type === 'telegram' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="telegram_bot_token">Bot Token *</Label>
                <div className="flex gap-2">
                  <Input
                    id="telegram_bot_token"
                    type={secretsVisibility.createTelegramToken ? "text" : "password"}
                    value={formData.telegram_bot_token}
                    onChange={(e) => setFormData({ ...formData, telegram_bot_token: e.target.value })}
                    placeholder="123456:ABC-DEF..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSecretsVisibility({
                      ...secretsVisibility,
                      createTelegramToken: !secretsVisibility.createTelegramToken,
                      editTelegramToken: secretsVisibility.editTelegramToken,
                      editDiscordToken: secretsVisibility.editDiscordToken,
                      editSecret: secretsVisibility.editSecret
                    })}
                  >
                    {secretsVisibility.createTelegramToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telegram_chat_id">Chat ID *</Label>
                <Input
                  id="telegram_chat_id"
                  value={formData.telegram_chat_id}
                  onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                  placeholder="123456789"
                />
              </div>
            </>
          )}

          {/* Discord Fields */}
          {formData.webhook_type === 'discord' && (
            <div className="space-y-2">
              <Label htmlFor="discord_webhook_url">Webhook URL *</Label>
              <Input
                id="discord_webhook_url"
                type="url"
                value={formData.discord_webhook_url}
                onChange={(e) => setFormData({ ...formData, discord_webhook_url: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
              />
            </div>
          )}

          {/* Secret */}
          <div className="space-y-2">
            <Label htmlFor="secret">Signing Secret</Label>
            <div className="flex gap-2">
              <Input
                id="secret"
                type={secretsVisibility.createSecret ? "text" : "password"}
                value={formData.secret}
                onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                placeholder="Optional signing secret"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSecretsVisibility({
                  ...secretsVisibility,
                  createSecret: !secretsVisibility.createSecret,
                  editTelegramToken: secretsVisibility.editTelegramToken,
                  editDiscordToken: secretsVisibility.editDiscordToken,
                  editSecret: secretsVisibility.editSecret
                })}
              >
                {secretsVisibility.createSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Custom Headers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Custom Headers</Label>
              <Button type="button" variant="outline" size="sm" onClick={addHeader}>
                <Plus className="h-4 w-4 mr-1" />
                Add Header
              </Button>
            </div>
            {customHeaders.map((header, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                />
                <Input
                  placeholder="Header value"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeHeader(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Events */}
          <div className="space-y-2">
            <Label>Events * ({selectedEvents.length} selected)</Label>
            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-4">
                {Object.entries(eventsByCategory).map(([category, events]) => (
                  <div key={category}>
                    <h4 className="font-semibold text-sm mb-2 capitalize">{category}</h4>
                    <div className="space-y-2">
                      {events.map((event) => (
                        <div key={event.name} className="flex items-center space-x-2">
                          <Checkbox
                            id={event.name}
                            checked={selectedEvents.includes(event.name)}
                            onCheckedChange={() => toggleEvent(event.name)}
                          />
                          <Label
                            htmlFor={event.name}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            <span className="font-mono">{event.name}</span>
                            <span className="text-muted-foreground ml-2">- {event.description}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-4" />
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
            <Label htmlFor="is_active" className="cursor-pointer">
              Active (webhook will receive events)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={creating}>
            {creating ? 'Creating...' : 'Create Webhook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

