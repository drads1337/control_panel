import React, { useEffect, useState } from 'react'
import { Plus, CheckCircle2, Send, AlertCircle, Play, Settings, Trash2, History, RefreshCw, Loader2, MessageSquare, MessageCircle, Link } from 'lucide-react'
import { Card } from '@/shared/ui/components/card'
import { Button } from '@/shared/ui/components/button'
import { useWebhookActions, useWebhookDialogs } from './hooks'
import { WebhookFormDialog } from './components/WebhookFormDialog'
import { formatDistanceToNow } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/components/dialog'
import { webhookAPI } from '@/entities/webhook'
import type { WebhookLog, WebhookFormData } from './types'

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}

function formatPercentage(num: number): string {
  return `${num.toFixed(1)}%`
}

function getWebhookIcon(webhookType: string) {
  switch (webhookType) {
    case 'telegram':
      return <MessageSquare className="h-5 w-5 text-text-primary-dark" />
    case 'discord':
      return <MessageCircle className="h-5 w-5 text-text-primary-dark" />
    default:
      return <Link className="h-5 w-5 text-text-primary-dark" />
  }
}

function getStatusColor(isActive: boolean, failureCount: number) {
  if (!isActive) {
    return 'bg-text-secondary-dark/80'
  }
  if (failureCount > 0) {
    return 'bg-error/80'
  }
  return 'bg-success/80'
}

function getStatusBadge(isActive: boolean, failureCount: number) {
  if (!isActive) {
    return { text: 'Inactive', className: 'bg-text-secondary-dark/10 text-text-secondary-dark border-text-secondary-dark/20' }
  }
  if (failureCount > 0) {
    return { text: 'Failing', className: 'bg-error/10 text-error border-error/20' }
  }
  return { text: 'Active', className: 'bg-success/10 text-success border-success/20' }
}

export function WebhooksPage() {
  const {
    webhooks,
    stats,
    loading,
    refreshing,
    error,
    loadData,
    handleCreateWebhook,
    handleEditWebhook,
    handleDeleteWebhook,
    handleTestWebhook,
    handleToggleStatus,
    handleRefresh
  } = useWebhookActions()

  const {
    createDialogOpen,
    editDialogOpen,
    logsDialogOpen,
    editingWebhook,
    viewingLogsWebhook,
    formData,
    setFormData,
    secretsVisibility,
    setSecretsVisibility,
    customHeaders,
    setCustomHeaders,
    originalWebhookData,
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
    openLogsDialog,
    closeLogsDialog
  } = useWebhookDialogs()

  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (logsDialogOpen && viewingLogsWebhook) {
      loadWebhookLogs(viewingLogsWebhook.id)
    }
  }, [logsDialogOpen, viewingLogsWebhook])

  const loadWebhookLogs = async (webhookId: number) => {
    setLoadingLogs(true)
    try {
      const webhookLogs = await webhookAPI.getWebhookLogs(webhookId, 100)
      setLogs(webhookLogs)
    } catch (error) {
      console.error('Failed to load webhook logs:', error)
      setLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleCreateSubmit = async (formData: WebhookFormData, customHeaders: Array<{ key: string, value: string }>) => {
    const success = await handleCreateWebhook(formData, customHeaders)
    if (success) {
      closeCreateDialog()
    }
    return success
  }

  const handleEditSubmit = async (formData: WebhookFormData, customHeaders: Array<{ key: string, value: string }>) => {
    if (!editingWebhook) return false
    const success = await handleEditWebhook(editingWebhook.id, formData, customHeaders, originalWebhookData)
    if (success) {
      closeEditDialog()
    }
    return success
  }

  const handleDelete = async (webhookId: number) => {
    if (window.confirm('Are you sure you want to delete this webhook?')) {
      await handleDeleteWebhook(webhookId)
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-text-secondary-dark" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary-dark">Webhooks</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-text-secondary-dark hover:text-text-primary-dark"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={openCreateDialog}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Webhook
          </Button>
        </div>
      </div>

      {error && (
        <Card className="bg-error/10 border-error/20 rounded p-4">
          <div className="text-sm text-error">{error}</div>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[
          {
            label: 'Success Rate',
            val: stats ? formatPercentage(stats.recent_success_rate) : '0%',
            sub: 'LAST 24H',
            Icon: CheckCircle2,
            iconColor: 'text-success'
          },
          {
            label: 'Events Sent',
            val: stats ? formatNumber(stats.total_success) : '0',
            sub: 'TOTAL',
            Icon: Send,
            iconColor: 'text-primary'
          },
          {
            label: 'Failures',
            val: stats ? stats.total_failures.toString() : '0',
            sub: 'REQUIRE ATTENTION',
            Icon: AlertCircle,
            iconColor: 'text-error'
          },
        ].map((item, i) => (
          <Card key={i} className="bg-surface-dark border-border-dark rounded p-4 flex flex-col justify-between h-24 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
            <div className="flex justify-between items-start z-10">
              <div className="flex items-center gap-2 text-text-secondary-dark text-xs font-semibold uppercase tracking-wider">
                <item.Icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
                {item.label}
              </div>
            </div>
            <div className="z-10 flex items-end justify-between">
              <div className="text-2xl font-bold text-text-primary-dark font-mono-numbers tracking-tight">{item.val}</div>
              <div className="text-[10px] text-text-secondary-dark mb-1 font-mono-numbers text-right">{item.sub}</div>
            </div>
            {i === 0 && stats && stats.recent_success_rate > 90 && (
              <div className="absolute right-0 bottom-0 h-8 w-24 opacity-20">
                <div className="flex items-end h-full w-full gap-1 px-2 pb-2">
                  <div className="w-1 bg-success h-3/4 rounded-t-sm"></div>
                  <div className="w-1 bg-success h-full rounded-t-sm"></div>
                  <div className="w-1 bg-success h-2/3 rounded-t-sm"></div>
                  <div className="w-1 bg-success h-5/6 rounded-t-sm"></div>
                  <div className="w-1 bg-success h-full rounded-t-sm"></div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Webhooks List */}
      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <Card className="bg-surface-dark border-border-dark rounded p-8 text-center">
            <div className="text-text-secondary-dark">No webhooks configured</div>
            <Button
              onClick={openCreateDialog}
              className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Your First Webhook
            </Button>
          </Card>
        ) : (
          webhooks.map((webhook) => {
            const statusBadge = getStatusBadge(webhook.is_active, webhook.failure_count)
            const lastTriggered = webhook.last_triggered
              ? formatDistanceToNow(new Date(webhook.last_triggered), { addSuffix: true })
              : 'Never'

            return (
              <Card
                key={webhook.id}
                className="bg-surface-dark border-border-dark rounded p-4 flex flex-col md:flex-row md:items-center justify-between hover:border-primary/50 transition-all group relative overflow-hidden gap-4 md:gap-0 shadow-sm"
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusColor(webhook.is_active, webhook.failure_count)}`}
                ></div>
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 pl-2 flex-1">
                  <div className="w-10 h-10 rounded bg-background-dark border border-border-dark flex items-center justify-center flex-shrink-0">
                    {getWebhookIcon(webhook.webhook_type)}
                  </div>
                  <div className="min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-text-primary-dark tracking-wide">{webhook.name}</h3>
                      <span className={`text-[9px] px-1.5 py-px rounded-full border font-mono-numbers tracking-wide uppercase ${statusBadge.className}`}>
                        {statusBadge.text}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-secondary-dark font-mono-numbers flex items-center gap-2">
                      <span className="bg-white/5 px-1 rounded text-text-secondary-dark">POST</span>
                      <span className="truncate max-w-[200px] opacity-70">
                        {webhook.webhook_type === 'custom'
                          ? webhook.url || 'No URL'
                          : webhook.webhook_type === 'telegram'
                          ? `Telegram: ${webhook.telegram_chat_id || 'N/A'}`
                          : `Discord: ${webhook.discord_channel_id || 'N/A'}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {webhook.events.slice(0, 3).map((event) => (
                      <span
                        key={event}
                        className="text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest bg-background-dark border border-border-dark px-2 py-0.5 rounded"
                      >
                        {event}
                      </span>
                    ))}
                    {webhook.events.length > 3 && (
                      <span className="text-[9px] text-text-secondary-dark">+{webhook.events.length - 3} more</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6 md:pl-8 md:border-l border-white/5">
                  <div className="text-right hidden sm:block">
                    <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Last Delivery</div>
                    <div className={`text-xs font-mono-numbers flex items-center gap-1 justify-end ${webhook.failure_count > 0 ? 'text-error' : 'text-text-primary-dark'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${webhook.failure_count > 0 ? 'bg-error' : 'bg-success'}`}></span>
                      {lastTriggered}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTestWebhook(webhook.id)}
                      className="w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:bg-white/5 rounded transition-colors hover:text-text-primary-dark"
                      title="Test webhook"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openLogsDialog(webhook)}
                      className="w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:bg-white/5 rounded transition-colors hover:text-text-primary-dark"
                      title="View logs"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEditDialog(webhook)}
                      className="w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:bg-white/5 rounded transition-colors hover:text-text-primary-dark"
                      title="Edit webhook"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(webhook.id)}
                      className="w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:bg-white/5 rounded transition-colors hover:text-error"
                      title="Delete webhook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Create Webhook Dialog */}
      <WebhookFormDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeCreateDialog()
        }}
        onSubmit={handleCreateSubmit}
        formData={formData}
        setFormData={setFormData}
        customHeaders={customHeaders}
        setCustomHeaders={setCustomHeaders}
        secretsVisibility={secretsVisibility}
        setSecretsVisibility={setSecretsVisibility}
      />

      {/* Edit Webhook Dialog */}
      <WebhookFormDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeEditDialog()
        }}
        onSubmit={handleEditSubmit}
        editingWebhook={editingWebhook}
        formData={formData}
        setFormData={setFormData}
        customHeaders={customHeaders}
        setCustomHeaders={setCustomHeaders}
        secretsVisibility={secretsVisibility}
        setSecretsVisibility={setSecretsVisibility}
      />

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={(open) => {
        if (!open) closeLogsDialog()
      }}>
        <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-text-primary-dark">
              Webhook Logs: {viewingLogsWebhook?.name}
            </DialogTitle>
            <DialogDescription className="text-text-secondary-dark">
              Recent webhook delivery attempts
            </DialogDescription>
          </DialogHeader>
          {loadingLogs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-text-secondary-dark" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-text-secondary-dark text-center py-8">No logs available</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded border ${
                    log.success
                      ? 'bg-success/10 border-success/20'
                      : 'bg-error/10 border-error/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-text-primary-dark">{log.event}</span>
                    <span className={`text-xs ${log.success ? 'text-success' : 'text-error'}`}>
                      {log.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  {log.error_message && (
                    <div className="text-xs text-error mt-1">{log.error_message}</div>
                  )}
                  {log.response_status && (
                    <div className="text-xs text-text-secondary-dark mt-1">Status: {log.response_status}</div>
                  )}
                  <div className="text-xs text-text-secondary-dark mt-1">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

