import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui/components/dialog'
import { Button } from '@/shared/ui/components/button'
import { Input } from '@/shared/ui/components/input'
import { Label } from '@/shared/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/components/select'
import { Checkbox } from '@/shared/ui/components/checkbox'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { webhookAPI } from '@/entities/webhook'
import type { WebhookFormData, WebhookData } from '../types'

interface WebhookFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (formData: WebhookFormData, customHeaders: Array<{ key: string, value: string }>) => Promise<boolean>
  editingWebhook?: WebhookData | null
  formData: WebhookFormData
  setFormData: React.Dispatch<React.SetStateAction<WebhookFormData>>
  customHeaders: Array<{ key: string, value: string }>
  setCustomHeaders: React.Dispatch<React.SetStateAction<Array<{ key: string, value: string }>>>
  secretsVisibility: {
    createTelegramToken?: boolean
    createDiscordToken?: boolean
    createSecret?: boolean
    editTelegramToken?: boolean
    editDiscordToken?: boolean
    editSecret?: boolean
  }
  setSecretsVisibility: React.Dispatch<React.SetStateAction<any>>
}

export function WebhookFormDialog({
  open,
  onOpenChange,
  onSubmit,
  editingWebhook,
  formData,
  setFormData,
  customHeaders,
  setCustomHeaders,
  secretsVisibility,
  setSecretsVisibility
}: WebhookFormDialogProps) {
  const [availableEvents, setAvailableEvents] = useState<{ events: string[], categories: Record<string, string[]> } | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<string[]>(formData.events || [])
  const [loading, setLoading] = useState(false)
  const [loadingEvents, setLoadingEvents] = useState(false)

  const isEdit = !!editingWebhook
  const isCreate = !isEdit

  useEffect(() => {
    if (open) {
      setSelectedEvents(formData.events || [])
      loadEvents()
    }
  }, [open, formData.events])

  const loadEvents = async () => {
    if (availableEvents) return
    setLoadingEvents(true)
    try {
      const events = await webhookAPI.getWebhookEvents()
      setAvailableEvents(events)
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoadingEvents(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const success = await onSubmit(
        { ...formData, events: selectedEvents },
        customHeaders
      )
      if (success) {
        onOpenChange(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
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

  const getSecretVisibilityKey = (type: 'telegram' | 'discord' | 'secret') => {
    if (isCreate) {
      return type === 'telegram' ? 'createTelegramToken' : type === 'discord' ? 'createDiscordToken' : 'createSecret'
    } else {
      return type === 'telegram' ? 'editTelegramToken' : type === 'discord' ? 'editDiscordToken' : 'editSecret'
    }
  }

  const toggleSecretVisibility = (type: 'telegram' | 'discord' | 'secret') => {
    const key = getSecretVisibilityKey(type)
    setSecretsVisibility((prev: any) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-text-primary-dark">
            {isEdit ? 'Edit Webhook' : 'Create Webhook'}
          </DialogTitle>
          <DialogDescription className="text-text-secondary-dark">
            {isEdit ? 'Update webhook configuration' : 'Configure a new webhook endpoint'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-text-secondary-dark">Name *</Label>
            <Input
              id="name"
              className="bg-background-dark border-border-dark text-text-primary-dark"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Webhook name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_type" className="text-text-secondary-dark">Type *</Label>
            <Select
              value={formData.webhook_type}
              onValueChange={(value: 'telegram' | 'discord' | 'custom') =>
                setFormData({ ...formData, webhook_type: value })
              }
            >
              <SelectTrigger className="bg-background-dark border-border-dark text-text-primary-dark">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-dark border-border-dark">
                <SelectItem value="custom">Custom URL</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.webhook_type === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="url" className="text-text-secondary-dark">URL *</Label>
              <Input
                id="url"
                className="bg-background-dark border-border-dark text-text-primary-dark"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com/webhook"
                required
              />
            </div>
          )}

          {formData.webhook_type === 'telegram' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="telegram_bot_token" className="text-text-secondary-dark">Bot Token *</Label>
                <div className="flex gap-2">
                  <Input
                    id="telegram_bot_token"
                    className="bg-background-dark border-border-dark text-text-primary-dark flex-1"
                    type={secretsVisibility[getSecretVisibilityKey('telegram')] ? 'text' : 'password'}
                    value={formData.telegram_bot_token}
                    onChange={(e) => setFormData({ ...formData, telegram_bot_token: e.target.value })}
                    placeholder="Bot token"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleSecretVisibility('telegram')}
                    className="text-text-secondary-dark hover:text-text-primary-dark"
                  >
                    {secretsVisibility[getSecretVisibilityKey('telegram')] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telegram_chat_id" className="text-text-secondary-dark">Chat ID *</Label>
                <Input
                  id="telegram_chat_id"
                  className="bg-background-dark border-border-dark text-text-primary-dark"
                  value={formData.telegram_chat_id}
                  onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                  placeholder="Chat ID"
                  required
                />
              </div>
            </>
          )}

          {formData.webhook_type === 'discord' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="discord_webhook_url" className="text-text-secondary-dark">Webhook URL</Label>
                <Input
                  id="discord_webhook_url"
                  className="bg-background-dark border-border-dark text-text-primary-dark"
                  type="url"
                  value={formData.discord_webhook_url}
                  onChange={(e) => setFormData({ ...formData, discord_webhook_url: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discord_bot_token" className="text-text-secondary-dark">Bot Token</Label>
                <div className="flex gap-2">
                  <Input
                    id="discord_bot_token"
                    className="bg-background-dark border-border-dark text-text-primary-dark flex-1"
                    type={secretsVisibility[getSecretVisibilityKey('discord')] ? 'text' : 'password'}
                    value={formData.discord_bot_token}
                    onChange={(e) => setFormData({ ...formData, discord_bot_token: e.target.value })}
                    placeholder="Bot token"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleSecretVisibility('discord')}
                    className="text-text-secondary-dark hover:text-text-primary-dark"
                  >
                    {secretsVisibility[getSecretVisibilityKey('discord')] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discord_channel_id" className="text-text-secondary-dark">Channel ID</Label>
                <Input
                  id="discord_channel_id"
                  className="bg-background-dark border-border-dark text-text-primary-dark"
                  value={formData.discord_channel_id}
                  onChange={(e) => setFormData({ ...formData, discord_channel_id: e.target.value })}
                  placeholder="Channel ID"
                />
              </div>
            </>
          )}

          {formData.webhook_type === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="secret" className="text-text-secondary-dark">Signing Secret</Label>
              <div className="flex gap-2">
                <Input
                  id="secret"
                  className="bg-background-dark border-border-dark text-text-primary-dark flex-1"
                  type={secretsVisibility[getSecretVisibilityKey('secret')] ? 'text' : 'password'}
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder="Secret key"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleSecretVisibility('secret')}
                  className="text-text-secondary-dark hover:text-text-primary-dark"
                >
                  {secretsVisibility[getSecretVisibilityKey('secret')] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-text-secondary-dark">Events *</Label>
            {loadingEvents ? (
              <div className="text-text-secondary-dark text-sm">Loading events...</div>
            ) : availableEvents ? (
              <div className="max-h-48 overflow-y-auto border border-border-dark rounded p-3 bg-background-dark space-y-2">
                {Object.entries(availableEvents.categories).map(([category, events]) => (
                  <div key={category} className="space-y-1">
                    <div className="text-xs font-semibold text-text-secondary-dark uppercase">{category}</div>
                    <div className="flex flex-wrap gap-2">
                      {events.map(event => (
                        <label
                          key={event}
                          className="flex items-center gap-2 cursor-pointer text-xs"
                        >
                          <Checkbox
                            checked={selectedEvents.includes(event)}
                            onCheckedChange={() => toggleEvent(event)}
                            className="border-border-dark"
                          />
                          <span className="text-text-secondary-dark">{event}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-text-secondary-dark text-sm">No events available</div>
            )}
          </div>

          {formData.webhook_type === 'custom' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-text-secondary-dark">Custom Headers</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addHeader}
                  className="text-text-secondary-dark hover:text-text-primary-dark"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Header
                </Button>
              </div>
              {customHeaders.map((header, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    className="bg-background-dark border-border-dark text-text-primary-dark"
                    placeholder="Header name"
                    value={header.key}
                    onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  />
                  <Input
                    className="bg-background-dark border-border-dark text-text-primary-dark"
                    placeholder="Header value"
                    value={header.value}
                    onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHeader(index)}
                    className="text-text-secondary-dark hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked === true })
              }
              className="border-border-dark"
            />
            <Label htmlFor="is_active" className="text-text-secondary-dark cursor-pointer">
              Active
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-text-secondary-dark hover:text-text-primary-dark"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

