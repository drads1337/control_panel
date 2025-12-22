import React, { useEffect, useState } from 'react'
import { 
  Plus, Copy, Edit, RefreshCw, Loader2,
  Play, AlertCircle, CheckCircle2, XCircle
} from 'lucide-react'
import { Card } from '@/shared/ui/components/card'
import { Button } from '@/shared/ui/components/button'
import { Badge } from '@/shared/ui/components/badge'
import { cn } from '@/shared/lib/utils/utils'
import { useWebhookActions, useWebhookDialogs } from './hooks'
import { WebhookFormDialog } from './components/WebhookFormDialog'
import { formatDistanceToNow } from 'date-fns'
import { webhookAPI } from '@/entities/webhook'
import type { WebhookLog, WebhookFormData, WebhookData } from './types'

export function WebhooksPage() {
  const {
    webhooks,
    loading,
    error,
    loadData,
    handleCreateWebhook,
    handleEditWebhook,
    handleDeleteWebhook,
    handleTestWebhook,
  } = useWebhookActions()

  const {
    createDialogOpen,
    editDialogOpen,
    editingWebhook,
    formData,
    setFormData,
    customHeaders,
    setCustomHeaders,
    secretsVisibility,
    setSecretsVisibility,
    originalWebhookData,
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
  } = useWebhookDialogs()

  const [selectedWebhookId, setSelectedWebhookId] = useState<number | null>(null)
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'payload' | 'headers'>('payload')
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (selectedWebhookId) {
      loadWebhookLogs(selectedWebhookId)
    } else {
      setLogs([])
      setSelectedLogId(null)
    }
  }, [selectedWebhookId])

  useEffect(() => {
    // Auto-select first webhook if available
    if (webhooks.length > 0 && !selectedWebhookId) {
      setSelectedWebhookId(webhooks[0].id)
    }
  }, [webhooks, selectedWebhookId])

  const loadWebhookLogs = async (webhookId: number) => {
    setLoadingLogs(true)
    try {
      const webhookLogs = await webhookAPI.getWebhookLogs(webhookId, 100)
      setLogs(webhookLogs)
      if (webhookLogs.length > 0 && !selectedLogId) {
        setSelectedLogId(webhookLogs[0].id)
      }
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
      if (selectedWebhookId === webhookId) {
        setSelectedWebhookId(null)
        setSelectedLogId(null)
      }
    }
  }

  const selectedWebhook = webhooks.find(w => w.id === selectedWebhookId)
  const selectedLog = logs.find(l => l.id === selectedLogId)

  const getWebhookUrl = (webhook: WebhookData): string => {
    if (webhook.webhook_type === 'custom') {
      return webhook.url || 'No URL'
    }
    if (webhook.webhook_type === 'telegram') {
      return `Telegram: ${webhook.telegram_chat_id || 'N/A'}`
    }
    return `Discord: ${webhook.discord_channel_id || 'N/A'}`
  }

  const getWebhookStatus = (webhook: WebhookData): 'online' | 'paused' | 'error' => {
    if (!webhook.is_active) return 'paused'
    if (webhook.failure_count > 0) return 'error'
    return 'online'
  }

  const formatPayload = (payload: any): string => {
    if (!payload) return ''
    return JSON.stringify(payload, null, 2)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (loading && webhooks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-text-secondary-dark" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {error && (
        <Card className="bg-error/10 border-error/20 rounded-sm p-4 mb-4">
          <div className="text-sm text-error">{error}</div>
        </Card>
      )}

      <div className="flex h-[calc(100vh-140px)] border border-border-dark rounded-sm overflow-hidden bg-background-dark shadow-sm font-mono text-sm">
        {/* PANE 1: ENDPOINTS LIST (Left) */}
        <div className="w-64 bg-[#111318] border-r border-border-dark flex flex-col shrink-0">
          <div className="p-3 border-b border-border-dark flex justify-between items-center bg-surface-dark/50">
            <span className="text-[10px] font-bold text-text-secondary-dark uppercase tracking-wider">Endpoints</span>
            <Button
              onClick={openCreateDialog}
              variant="ghost"
              size="icon"
              className="text-text-secondary-dark hover:text-white h-auto w-auto p-0"
              title="Add endpoint"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {webhooks.length === 0 ? (
              <div className="text-center py-8 text-text-secondary-dark text-[10px]">
                No endpoints configured
                <Button
                  onClick={openCreateDialog}
                  className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Endpoint
                </Button>
              </div>
            ) : (
              webhooks.map((webhook) => {
                const status = getWebhookStatus(webhook)
                const isSelected = selectedWebhookId === webhook.id
                
                return (
                  <button 
                    key={webhook.id}
                    onClick={() => setSelectedWebhookId(webhook.id)}
                    className={`w-full text-left p-3 border-b border-border-dark/30 transition-all group relative ${
                      isSelected 
                      ? 'bg-[#1A1D24]' 
                      : 'hover:bg-white/5'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"></div>
                    )}
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-text-secondary-dark'}`}>
                        {webhook.name}
                      </span>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        status === 'online' ? 'bg-emerald-500' : 
                        status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}></div>
                    </div>
                    <div className="text-[9px] text-text-secondary-dark truncate opacity-60 mb-2">
                      {getWebhookUrl(webhook)}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {webhook.events.slice(0, 3).map(ev => (
                        <Badge 
                          key={ev} 
                          variant="outline"
                          className="text-[9px] bg-background-dark border border-border-dark px-1.5 py-0.5 rounded text-text-secondary-dark h-auto"
                        >
                          {ev}
                        </Badge>
                      ))}
                      {webhook.events.length > 3 && (
                        <span className="text-[9px] text-text-secondary-dark">+{webhook.events.length - 3}</span>
                      )}
                    </div>
                    {isSelected && (
                      <div className="flex gap-1 mt-2 pt-2 border-t border-border-dark/30">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditDialog(webhook)
                          }}
                          variant="ghost"
                          size="icon"
                          className="p-1 hover:bg-white/10 h-auto w-auto text-text-secondary-dark hover:text-white"
                          title="Edit"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTestWebhook(webhook.id)
                          }}
                          variant="ghost"
                          size="icon"
                          className="p-1 hover:bg-white/10 h-auto w-auto text-text-secondary-dark hover:text-white"
                          title="Test"
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(webhook.id)
                          }}
                          variant="ghost"
                          size="icon"
                          className="p-1 hover:bg-white/10 h-auto w-auto text-text-secondary-dark hover:text-red-400"
                          title="Delete"
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* PANE 2: EVENT STREAM (Middle) */}
        <div className="w-80 bg-[#15181E] border-r border-border-dark flex flex-col shrink-0">
          <div className="p-3 border-b border-border-dark flex justify-between items-center bg-surface-dark/50">
            <span className="text-[10px] font-bold text-text-secondary-dark uppercase tracking-wider">Event Stream</span>
            <div className="flex items-center gap-2">
              {selectedWebhook && (
                <span className="text-[9px] text-text-secondary-dark opacity-60 font-mono">{logs.length} items</span>
              )}
              {selectedWebhook && (
                <Button
                  onClick={() => selectedWebhookId && loadWebhookLogs(selectedWebhookId)}
                  variant="ghost"
                  size="icon"
                  className="p-1 hover:bg-white/10 h-auto w-auto text-text-secondary-dark hover:text-white"
                  title="Refresh"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {!selectedWebhookId ? (
              <div className="text-text-secondary-dark text-center py-8 text-[10px]">
                Select an endpoint to view events
              </div>
            ) : loadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-text-secondary-dark" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-text-secondary-dark text-center py-8 text-[10px]">
                No events found
              </div>
            ) : (
              logs.map((log) => {
                const isSelected = selectedLogId === log.id
                return (
                  <button 
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className={`w-full text-left p-3 border-b border-border-dark/50 transition-all group ${
                      isSelected 
                      ? 'bg-primary/5 border-l-2 border-l-primary' 
                      : 'hover:bg-white/5 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className={`text-[11px] font-bold ${isSelected ? 'text-primary' : 'text-text-primary-dark'}`}>
                        {log.event}
                      </span>
                      <Badge 
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1 rounded font-bold h-auto",
                          log.success 
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                            : 'text-red-400 bg-red-500/10 border-red-500/20'
                        )}
                      >
                        {log.response_status || (log.success ? 200 : 500)}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-text-secondary-dark opacity-80 font-mono">
                      <span className="truncate mr-2">#{log.id}</span>
                      <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* PANE 3: INSPECTOR (Right) */}
        <div className="flex-1 bg-[#0D1117] flex flex-col min-w-0">
          {/* Inspector Header */}
          <div className="h-12 border-b border-border-dark flex items-center justify-between px-4 bg-surface-dark/20 shrink-0">
            {selectedLog ? (
              <>
                <div className="flex items-center gap-6">
                  <Badge 
                    variant="outline"
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold h-auto",
                      selectedLog.success 
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' 
                        : 'border-red-500/30 text-red-400 bg-red-500/10'
                    )}
                  >
                    {selectedLog.response_status || (selectedLog.success ? '200 OK' : '500 ERR')}
                  </Badge>
                  
                  <div className="flex flex-col">
                    <span className="text-[9px] text-text-secondary-dark uppercase tracking-wider opacity-60">Event ID</span>
                    <span className="text-[11px] font-bold text-white leading-none select-all">#{selectedLog.id}</span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-[9px] text-text-secondary-dark uppercase tracking-wider opacity-60">Event</span>
                    <span className="text-[11px] font-bold text-white leading-none">{selectedLog.event}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => selectedLog.payload && copyToClipboard(formatPayload(selectedLog.payload))}
                    variant="ghost"
                    size="icon"
                    className="p-1.5 text-text-secondary-dark hover:text-white border border-transparent hover:border-border-dark h-auto w-auto"
                    title="Copy JSON"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-text-secondary-dark text-[10px]">Select an event to inspect</div>
            )}
          </div>

          {/* Inspector Tabs */}
          {selectedLog && (
            <>
              <div className="flex border-b border-border-dark bg-[#0F1115] shrink-0">
                <Button
                  onClick={() => setViewMode('payload')}
                  variant="ghost"
                  className={cn(
                    "px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-b-2 rounded-none h-auto",
                    viewMode === 'payload' 
                      ? 'border-primary text-white bg-white/5' 
                      : 'border-transparent text-text-secondary-dark hover:text-text-primary-dark'
                  )}
                >
                  Request Payload
                </Button>
                <Button
                  onClick={() => setViewMode('headers')}
                  variant="ghost"
                  className={cn(
                    "px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-b-2 rounded-none h-auto",
                    viewMode === 'headers' 
                      ? 'border-primary text-white bg-white/5' 
                      : 'border-transparent text-text-secondary-dark hover:text-text-primary-dark'
                  )}
                >
                  Headers
                </Button>
              </div>

              {/* Code Viewer */}
              <div className="flex-1 overflow-auto p-4 bg-[#0D1117]">
                {viewMode === 'payload' ? (
                  <pre className="text-[11px] leading-relaxed font-mono text-gray-300">
                    {selectedLog.payload ? (
                      formatPayload(selectedLog.payload).split('\n').map((line, i) => {
                        return (
                          <div key={i} className="hover:bg-white/5 px-2 -mx-2 rounded-sm table-row">
                            <span className="text-gray-600 select-none w-8 table-cell text-right pr-4 text-[9px] opacity-50">
                              {i + 1}
                            </span>
                            <span 
                              className="table-cell"
                              dangerouslySetInnerHTML={{ 
                                __html: line
                                  .replace(/"([^"]+)":/g, '<span class="text-blue-400">"$1"</span>:')
                                  .replace(/: "([^"]+)"/g, ': <span class="text-emerald-400">"$1"</span>')
                                  .replace(/: ([0-9]+)/g, ': <span class="text-orange-400">$1</span>')
                                  .replace(/: (true|false|null)/g, ': <span class="text-purple-400">$1</span>')
                              }} 
                            />
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-text-secondary-dark text-[10px]">No payload available</div>
                    )}
                  </pre>
                ) : (
                  <div className="space-y-1 font-mono">
                    {selectedWebhook && selectedWebhook.headers && Object.entries(selectedWebhook.headers).length > 0 ? (
                      Object.entries(selectedWebhook.headers).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-12 border-b border-border-dark/30 py-2">
                          <span className="col-span-4 text-[10px] text-blue-400 font-bold">{key}</span>
                          <span className="col-span-8 text-[11px] text-text-secondary-dark break-all">{value}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-text-secondary-dark text-[10px] py-4">No custom headers configured</div>
                    )}
                    <div className="grid grid-cols-12 border-b border-border-dark/30 py-2">
                      <span className="col-span-4 text-[10px] text-blue-400 font-bold">Content-Type</span>
                      <span className="col-span-8 text-[11px] text-text-secondary-dark">application/json; charset=utf-8</span>
                    </div>
                    {selectedWebhook?.secret && (
                      <div className="grid grid-cols-12 border-b border-border-dark/30 py-2">
                        <span className="col-span-4 text-[10px] text-blue-400 font-bold">X-Webhook-Signature</span>
                        <span className="col-span-8 text-[11px] text-text-secondary-dark break-all opacity-60">
                          sha256=*** (signature present)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Info */}
              <div className="p-2 border-t border-border-dark bg-[#0F1115] flex justify-between items-center text-[9px] text-text-secondary-dark font-mono">
                <div className="flex items-center gap-2">
                  <span className="bg-white/10 px-1 rounded text-white">POST</span>
                  <span className="truncate max-w-md">{selectedWebhook && getWebhookUrl(selectedWebhook)}</span>
                </div>
                <span>
                  JSON • {selectedLog.payload ? JSON.stringify(selectedLog.payload).length : 0} bytes
                </span>
              </div>
            </>
          )}

          {!selectedLog && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-text-secondary-dark text-[10px] text-center">
                Select an event from the stream to view details
              </div>
            </div>
          )}
        </div>
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
    </div>
  )
}
