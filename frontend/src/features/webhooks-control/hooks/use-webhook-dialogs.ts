import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { isMaskedValue } from '@/shared/lib/webhook-utils'
import type { WebhookData, WebhookFormData, SecretsVisibility } from '../types'

const initialFormData: WebhookFormData = {
  name: '',
  webhook_type: 'custom',
  url: '',
  events: [],
  secret: '',
  is_active: true,
  headers: {},
  telegram_bot_token: '',
  telegram_chat_id: '',
  discord_webhook_url: '',
  discord_bot_token: '',
  discord_channel_id: ''
}

const initialSecretsVisibility: SecretsVisibility = {
  createTelegramToken: false,
  createDiscordToken: false,
  createSecret: false,
  editTelegramToken: false,
  editDiscordToken: false,
  editSecret: false
}

export function useWebhookDialogs() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [logsDialogOpen, setLogsDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookData | null>(null)
  const [viewingLogsWebhook, setViewingLogsWebhook] = useState<WebhookData | null>(null)
  const [viewingSettingsWebhook, setViewingSettingsWebhook] = useState<WebhookData | null>(null)
  const [formData, setFormData] = useState<WebhookFormData>(initialFormData)
  const [secretsVisibility, setSecretsVisibility] = useState<SecretsVisibility>(initialSecretsVisibility)
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string, value: string }>>([])
  const [originalWebhookData, setOriginalWebhookData] = useState<WebhookData | null>(null)

  const resetForm = useCallback(() => {
    setFormData(initialFormData)
    setCustomHeaders([])
    setOriginalWebhookData(null)
    setSecretsVisibility(initialSecretsVisibility)
  }, [])

  const openCreateDialog = useCallback(() => {
    resetForm()
    setCreateDialogOpen(true)
  }, [resetForm])

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false)
    resetForm()
  }, [resetForm])

  const openEditDialog = useCallback((webhook: WebhookData) => {
    setOriginalWebhookData(webhook)
    setEditingWebhook(webhook)
    
    // SECURITY: Don't populate masked values in form fields.
    // If a token/secret is masked (e.g., "abcd****xyz"), it means the backend
    // is protecting the value. We should show empty string instead, so the user
    // knows they need to enter a new value if they want to change it.
    // filterMaskedValues will handle filtering these out on submit.
    const getSecretValue = (value: string | null | undefined): string => {
      if (!value) return ''
      // If value is masked, return empty string so user knows to enter new value
      return isMaskedValue(value) ? '' : value
    }
    
    setFormData({
      name: webhook.name,
      webhook_type: webhook.webhook_type,
      url: webhook.url || '',
      events: webhook.events,
      secret: getSecretValue(webhook.secret),
      is_active: webhook.is_active,
      headers: webhook.headers || {},
      telegram_bot_token: getSecretValue(webhook.telegram_bot_token),
      telegram_chat_id: webhook.telegram_chat_id || '',
      discord_webhook_url: webhook.discord_webhook_url || '',
      discord_bot_token: getSecretValue(webhook.discord_bot_token),
      discord_channel_id: webhook.discord_channel_id || ''
    })

    const headersArray = Object.entries(webhook.headers || {}).map(([key, value]) => ({
      key,
      value
    }))
    setCustomHeaders(headersArray)
    setEditDialogOpen(true)
  }, [])

  const closeEditDialog = useCallback(() => {
    setEditDialogOpen(false)
    setEditingWebhook(null)
    setOriginalWebhookData(null)
    resetForm()
  }, [resetForm])

  const openLogsDialog = useCallback((webhook: WebhookData) => {
    setViewingLogsWebhook(webhook)
    setLogsDialogOpen(true)
  }, [])

  const closeLogsDialog = useCallback(() => {
    setLogsDialogOpen(false)
    setViewingLogsWebhook(null)
  }, [])

  const openSettingsDialog = useCallback((webhook: WebhookData) => {
    setViewingSettingsWebhook(webhook)
    setSettingsDialogOpen(true)
  }, [])

  const closeSettingsDialog = useCallback(() => {
    setSettingsDialogOpen(false)
    setViewingSettingsWebhook(null)
  }, [])

  return {
    // Dialog states
    createDialogOpen,
    editDialogOpen,
    logsDialogOpen,
    settingsDialogOpen,
    editingWebhook,
    viewingLogsWebhook,
    viewingSettingsWebhook,
    
    // Form states
    formData,
    setFormData,
    secretsVisibility,
    setSecretsVisibility,
    customHeaders,
    setCustomHeaders,
    originalWebhookData,
    
    // Dialog actions
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
    openLogsDialog,
    closeLogsDialog,
    openSettingsDialog,
    closeSettingsDialog,
    resetForm
  }
}
