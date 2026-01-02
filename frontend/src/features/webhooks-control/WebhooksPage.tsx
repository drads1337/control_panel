"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Plus, 
  Search, 
  Copy, 
  Send, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useWebhookActions, useWebhookDialogs } from './hooks'
import { webhookAPI } from '@/entities/webhook'
import type { WebhookData, WebhookLog } from './types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CreateWebhookDialog, WebhookStats } from './components'
import { EmptyState, AccessDenied } from '@/shared/ui/components'
import { useAuthContext } from '@/app/providers/auth-provider'
import { usePermissions } from '@/shared/hooks/use-permissions'

// --- Types ---

interface DeliveryLog {
  id: string
  event: string
  status: number
  timestamp: string
  duration: string
  reqId: string
}

// --- Sub-components ---

const StatusBadge: React.FC<{ status: number | string, type?: 'http' | 'state' }> = ({ status, type = 'state' }) => {
  if (type === 'http') {
    const code = status as number
    let colorClass = 'bg-muted text-muted-foreground border-border'
    if (code >= 200 && code < 300) colorClass = 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
    if (code >= 400 && code < 500) colorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'
    if (code >= 500) colorClass = 'bg-destructive/10 text-destructive border-destructive/30'
    
    return (
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold font-mono border", colorClass)}>
        {status}
      </span>
    )
  } else {
    const state = status as string
    let dotColor = 'bg-muted-foreground'
    let labelColor = 'text-muted-foreground'
    
    if (state === 'active') { 
      dotColor = 'bg-green-500'
      labelColor = 'text-green-700 dark:text-green-400'
    }
    if (state === 'failed' || state === 'inactive') { 
      dotColor = 'bg-destructive'
      labelColor = 'text-destructive'
    }

    return (
      <div className="flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full", dotColor)}></span>
        <span className={cn("text-xs font-medium capitalize", labelColor)}>
          {state === 'active' ? 'active' : state === 'failed' ? 'failed' : 'inactive'}
        </span>
      </div>
    )
  }
}

// Helper function to calculate stats from webhook data
const calculateWebhookStats = (webhook: WebhookData) => {
  const total = webhook.success_count + webhook.failure_count
  const successRate = total > 0 ? (webhook.success_count / total) * 100 : 0
  
  // Mock avg latency - in real app, this would come from logs
  const avgLatency = 145
  
  return {
    successRate: Number(successRate.toFixed(1)),
    totalRequests: total,
    avgLatency
  }
}

// Helper function to convert WebhookLog to DeliveryLog format
const convertLogToDelivery = (log: WebhookLog, index: number): DeliveryLog => {
  const date = new Date(log.created_at)
  const timestamp = date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(',', '')
  
  // Mock duration - in real app, this would come from log data
  const duration = log.success ? '145ms' : '5000ms'
  
  return {
    id: `del_${log.id}`,
    event: log.event,
    status: log.response_status || (log.success ? 200 : 500),
    timestamp,
    duration,
    reqId: `req_${log.id}`
  }
}

export function WebhooksPage() {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const { hasPermission } = usePermissions()
  
  const { 
    webhooks, 
    loading, 
    error,
    loadData, 
    handleToggleStatus, 
    handleDeleteWebhook, 
    handleTestWebhook 
  } = useWebhookActions()
  
  const { 
    createDialogOpen,
    editDialogOpen,
    logsDialogOpen,
    openCreateDialog, 
    closeCreateDialog,
    openEditDialog, 
    closeEditDialog,
    openLogsDialog,
    closeLogsDialog,
    formData,
    setFormData,
    secretsVisibility,
    setSecretsVisibility,
    customHeaders,
    setCustomHeaders,
    originalWebhookData
  } = useWebhookDialogs()
  
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'deliveries' | 'settings'>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [secretVisible, setSecretVisible] = useState(false)

  if (!isInitialized) {
    return null
  }

  if (!isAuthenticated || !user) {
    return (
      <AccessDenied
        isAuthenticated={false}
        hasAccess={false}
        user={user}
        message="You need to be logged in to view webhooks."
        useCard={true}
      />
    )
  }

  const canViewWebhooks = hasPermission('webhooks.view')
  
  if (!canViewWebhooks) {
    return (
      <AccessDenied
        isAuthenticated={true}
        hasAccess={false}
        user={user}
        message="You don't have permission to view webhooks."
        useCard={true}
      />
    )
  }

  // Load webhooks on mount
  useEffect(() => {
    loadData()
  }, [loadData])

  // Set first webhook as selected when webhooks load
  useEffect(() => {
    if (webhooks.length > 0 && selectedId === null) {
      setSelectedId(webhooks[0].id)
    }
  }, [webhooks, selectedId])

  // Load delivery logs when deliveries tab is active
  useEffect(() => {
    if (activeTab === 'deliveries' && selectedId) {
      loadDeliveryLogs(selectedId)
    }
  }, [activeTab, selectedId])

  const loadDeliveryLogs = async (webhookId: number) => {
    setLoadingLogs(true)
    try {
      const logs = await webhookAPI.getWebhookLogs(webhookId, 100)
      const convertedLogs = logs.map((log, index) => convertLogToDelivery(log, index))
      setDeliveryLogs(convertedLogs)
    } catch (error) {
      console.error('Error loading delivery logs:', error)
      toast.error('Failed to load delivery logs')
      setDeliveryLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }

  const filteredWebhooks = useMemo(() => {
    return webhooks.filter(w => 
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.url?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [webhooks, searchTerm])

  const selectedHook = useMemo(() => {
    return webhooks.find(w => w.id === selectedId) || null
  }, [webhooks, selectedId])

  const stats = useMemo(() => {
    if (!selectedHook) return null
    return calculateWebhookStats(selectedHook)
  }, [selectedHook])

  const handleCopyUrl = () => {
    if (selectedHook?.url) {
      navigator.clipboard.writeText(selectedHook.url)
      toast.success('URL copied to clipboard')
    }
  }

  const handleCopySecret = () => {
    if (selectedHook?.secret) {
      navigator.clipboard.writeText(selectedHook.secret)
      toast.success('Secret copied to clipboard')
    }
  }

  const handleSendTest = async () => {
    if (!selectedId) return
    await handleTestWebhook(selectedId)
  }

  const handleDisable = async () => {
    if (!selectedHook) return
    await handleToggleStatus(selectedHook)
  }

  const handleDelete = async () => {
    if (!selectedId) return
    if (confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) {
      await handleDeleteWebhook(selectedId)
      if (webhooks.length > 1) {
        const remaining = webhooks.filter(w => w.id !== selectedId)
        setSelectedId(remaining[0]?.id || null)
      } else {
        setSelectedId(null)
      }
    }
  }

  // Debug logging - remove in production
  useEffect(() => {
    console.log('WebhooksPage state:', { 
      loading, 
      error, 
      webhooksCount: webhooks?.length || 0, 
      webhooks: webhooks?.slice(0, 2), // First 2 for debugging
      createDialogOpen
    })
  }, [loading, error, webhooks, createDialogOpen])

  // Render dialog outside of conditional returns so it's always available
  const dialogComponent = (
    <CreateWebhookDialog
      open={createDialogOpen}
      onOpenChange={closeCreateDialog}
      formData={formData}
      setFormData={setFormData}
      customHeaders={customHeaders}
      setCustomHeaders={setCustomHeaders}
      secretsVisibility={secretsVisibility}
      setSecretsVisibility={setSecretsVisibility}
      onSuccess={() => {
        loadData()
      }}
    />
  )

  if (loading) {
    return (
      <>
        {dialogComponent}
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
              <div className="px-4 lg:px-6 mb-2">
                <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
                  Webhooks
                </h1>
                <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
                  Manage webhook endpoints and monitor delivery status.
                </p>
              </div>
              <WebhookStats webhooks={[]} loading={true} />
            </div>
          </div>
        </div>
      </>
    )
  }

  // Show error state if there's an error
  if (error) {
    return (
      <>
        {dialogComponent}
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
              <div className="px-4 lg:px-6 mb-2">
                <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
                  Webhooks
                </h1>
                <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
                  Manage webhook endpoints and monitor delivery status.
                </p>
              </div>
              <div className="flex flex-col items-center justify-center gap-4 px-4 lg:px-6">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">Error loading webhooks</h2>
                  <p className="text-sm text-muted-foreground mb-4">{error}</p>
                  <Button onClick={() => loadData()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Show empty state only if not loading and no error and no webhooks
  if (!loading && !error && (!webhooks || webhooks.length === 0)) {
    return (
      <>
        {dialogComponent}
        <EmptyState
          title="No webhooks yet"
          description="Create your first webhook endpoint to receive real-time event notifications."
          actionLabel="Create Webhook"
          onAction={() => {
            console.log('Create button clicked, opening dialog...')
            openCreateDialog()
          }}
          icon={Plus}
        />
      </>
    )
  }

  // If we have webhooks, render the main UI
  if (!webhooks || webhooks.length === 0) {
    // This should not happen, but just in case
    return null
  }

  const selectedHookStatus = selectedHook?.is_active ? 'active' : 'inactive'

  return (
    <>
      {dialogComponent}
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
            {/* Header Section */}
            <div className="px-4 lg:px-6 mb-2">
              <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
                Webhooks
              </h1>
              <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
                Manage webhook endpoints and monitor delivery status. Webhooks allow you to receive real-time notifications about events in your system, enabling seamless integration with external services.
              </p>
            </div>
            
            {/* Stats Cards */}
            <WebhookStats webhooks={webhooks} loading={loading} />
            
            {/* Main Content */}
            <div className="flex flex-col md:flex-row h-[calc(100vh-300px)] min-h-[600px] bg-card border border-border rounded-xl overflow-hidden shadow-sm font-sans">
              
              {/* LEFT PANE: List */}
              <div className="w-full md:w-[350px] flex flex-col border-r border-border bg-muted/30">
                
                {/* Header / Search */}
                <div className="p-4 border-b border-border bg-card z-10">
                  <div className="flex items-center justify-between mb-4">
                     <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Endpoints</h2>
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={openCreateDialog}
                       className="h-8 w-8 p-0"
                     >
                       <Plus className="h-4 w-4" />
                     </Button>
                  </div>
                  <div className="relative">
                     <Search className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground h-4 w-4" />
                     <Input 
                        type="text"
                        placeholder="Filter endpoints..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs"
                     />
                  </div>
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto">
                  {filteredWebhooks.map(hook => {
                    const hookStats = calculateWebhookStats(hook)
                    const hookStatus = hook.is_active ? 'active' : 'inactive'
                    const isSelected = selectedId === hook.id
                    
                    return (
                      <div 
                        key={hook.id}
                        onClick={() => setSelectedId(hook.id)}
                        className={cn(
                          "p-4 border-b border-border cursor-pointer transition-all hover:bg-muted/50",
                          isSelected && "bg-muted relative after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-primary shadow-sm"
                        )}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h3 className={cn(
                            "text-sm font-bold truncate pr-2",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {hook.name}
                          </h3>
                          {!hook.is_active && (
                            <div title="Inactive">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate font-mono mb-2 opacity-80">
                          {hook.url || 'No URL'}
                        </div>
                        <div className="flex items-center justify-between">
                          <StatusBadge status={hookStatus} />
                          <span className={cn(
                            "text-[10px] font-bold",
                            hookStats.successRate > 98 ? "text-green-600 dark:text-green-500" : "text-destructive"
                          )}>
                            {hookStats.successRate}% Success
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* RIGHT PANE: Detail */}
              {selectedHook && (
                <div className="flex-1 flex flex-col min-w-0 bg-card">
                  
                  {/* Detail Header */}
                  <div className="px-6 py-4 border-b border-border flex flex-col md:flex-row md:items-start justify-between gap-4">
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                           <h2 className="text-xl font-bold text-foreground truncate">{selectedHook.name}</h2>
                           <StatusBadge status={selectedHookStatus} />
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Webhook endpoint configuration and delivery monitoring. This endpoint receives real-time notifications about system events.
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded border border-border w-fit max-w-full">
                           <span className="truncate">{selectedHook.url || 'No URL'}</span>
                           {selectedHook.url && (
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={handleCopyUrl}
                               className="h-6 w-6 p-0 ml-2"
                             >
                               <Copy className="h-3 w-3" />
                             </Button>
                           )}
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={handleDisable}
                          className="text-xs"
                        >
                          {selectedHook.is_active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button 
                          size="sm"
                          onClick={handleSendTest}
                          className="text-xs flex items-center gap-2"
                        >
                          <Send className="h-3 w-3" />
                          Send Test
                        </Button>
                     </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="px-6 flex border-b border-border">
                     {(['overview', 'deliveries', 'settings'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={cn(
                            "py-3 mr-6 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors",
                            activeTab === tab 
                              ? "border-primary text-primary" 
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {tab}
                        </button>
                     ))}
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
             
                     {/* OVERVIEW TAB */}
                     {activeTab === 'overview' && stats && (
                        <div className="space-y-6">
                           
                           {/* Description */}
                           <div className="mb-4">
                              <p className="text-sm text-muted-foreground">
                                 Overview of webhook performance and recent activity. Monitor delivery success rates, latency, and track all webhook events in real-time.
                              </p>
                           </div>
                           
                           {/* Stats Grid */}
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-5 bg-card border border-border rounded-xl shadow-sm">
                                 <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Success Rate</div>
                                 <div className="flex items-baseline gap-2">
                                    <span className={cn(
                                      "text-3xl font-bold",
                                      stats.successRate > 98 ? "text-green-500" : "text-destructive"
                                    )}>
                                      {stats.successRate}%
                                    </span>
                                    <span className="text-xs text-muted-foreground">All time</span>
                                 </div>
                                 <p className="text-xs text-muted-foreground mt-2">Percentage of successful webhook deliveries</p>
                              </div>
                              <div className="p-5 bg-card border border-border rounded-xl shadow-sm">
                                 <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Avg. Latency</div>
                                 <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-foreground">{stats.avgLatency}</span>
                                    <span className="text-xs text-muted-foreground">ms</span>
                                 </div>
                                 <p className="text-xs text-muted-foreground mt-2">Average response time for webhook deliveries</p>
                              </div>
                              <div className="p-5 bg-card border border-border rounded-xl shadow-sm">
                                 <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Requests</div>
                                 <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-foreground">
                                      {stats.totalRequests >= 1000 ? `${(stats.totalRequests / 1000).toFixed(1)}k` : stats.totalRequests}
                                    </span>
                                    <span className="text-xs text-muted-foreground">requests</span>
                                 </div>
                                 <p className="text-xs text-muted-foreground mt-2">Total number of webhook delivery attempts</p>
                              </div>
                           </div>

                           {/* Recent Activity Summary */}
                           <div>
                              <h3 className="text-sm font-bold text-foreground mb-3">Latest Activity</h3>
                              <p className="text-xs text-muted-foreground mb-4">
                                 Recent webhook delivery attempts. Click "View All Deliveries" to see the complete history.
                              </p>
                              <div className="bg-card border border-border rounded-xl overflow-hidden">
                                 {deliveryLogs.slice(0, 3).map((log) => (
                                    <div 
                                      key={log.id} 
                                      className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                                    >
                                       <div className="flex items-center gap-4">
                                          <StatusBadge status={log.status} type="http" />
                                          <span className="text-sm font-medium text-foreground">{log.event}</span>
                                       </div>
                                       <span className="text-xs text-muted-foreground font-mono">{log.timestamp}</span>
                                    </div>
                                 ))}
                                 {deliveryLogs.length === 0 && (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                      No delivery logs available. Webhook deliveries will appear here once events are triggered.
                                    </div>
                                 )}
                                 {deliveryLogs.length > 0 && (
                                    <div className="p-3 bg-muted border-t border-border text-center">
                                       <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setActiveTab('deliveries')} 
                                          className="text-xs"
                                       >
                                          View All Deliveries
                                       </Button>
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                     )}

                     {/* DELIVERIES TAB */}
                     {activeTab === 'deliveries' && (
                        <div className="h-full flex flex-col">
                           <div className="mb-4">
                              <p className="text-sm text-muted-foreground">
                                 Complete history of webhook delivery attempts. Monitor HTTP status codes, response times, and event details for debugging and monitoring purposes.
                              </p>
                           </div>
                           <div className="bg-card border border-border rounded-xl overflow-hidden flex-1 flex flex-col">
                              <div className="grid grid-cols-12 bg-muted border-b border-border p-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                 <div className="col-span-2">Status</div>
                                 <div className="col-span-3">Event</div>
                                 <div className="col-span-3">ID</div>
                                 <div className="col-span-2">Time</div>
                                 <div className="col-span-2 text-right">Duration</div>
                              </div>
                              <div className="flex-1 overflow-y-auto">
                                 {loadingLogs ? (
                                    <div className="flex items-center justify-center p-8">
                                       <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                    </div>
                                 ) : deliveryLogs.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-muted-foreground">
                                       No delivery logs available. Webhook deliveries will appear here once events are triggered.
                                    </div>
                                 ) : (
                                    deliveryLogs.map(log => (
                                       <div 
                                          key={log.id} 
                                          className="grid grid-cols-12 p-3 items-center border-b border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                                       >
                                          <div className="col-span-2">
                                             <StatusBadge status={log.status} type="http" />
                                          </div>
                                          <div className="col-span-3 text-sm font-medium text-foreground">{log.event}</div>
                                          <div className="col-span-3 text-xs font-mono text-muted-foreground">{log.reqId}</div>
                                          <div className="col-span-2 text-xs text-muted-foreground">{log.timestamp.split(' ')[1]}</div>
                                          <div className="col-span-2 text-xs text-muted-foreground text-right font-mono">{log.duration}</div>
                                       </div>
                                    ))
                                 )}
                              </div>
                           </div>
                        </div>
                     )}

                     {/* SETTINGS TAB */}
                     {activeTab === 'settings' && (
                        <div className="max-w-2xl space-y-6">
                           
                           {/* Description */}
                           <div className="mb-4">
                              <p className="text-sm text-muted-foreground">
                                 Configure webhook endpoint settings, manage signing secrets, and view subscribed events. Edit webhook configuration to update endpoint URL, events, or custom headers.
                              </p>
                           </div>
                           
                           {/* Basic Info */}
                           <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                              <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide">Endpoint Configuration</h3>
                              <p className="text-xs text-muted-foreground mb-4">
                                 Basic webhook endpoint information. The URL is where webhook events will be delivered.
                              </p>
                              <div className="space-y-4">
                                 <div>
                                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase">Endpoint URL</label>
                                    <Input 
                                      type="text" 
                                      value={selectedHook.url || ''} 
                                      readOnly
                                      className="w-full font-mono" 
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">The destination URL for webhook deliveries</p>
                                 </div>
                                 <div>
                                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase">Description</label>
                                    <Input 
                                      type="text" 
                                      value={selectedHook.name} 
                                      readOnly
                                      className="w-full" 
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">A descriptive name for this webhook endpoint</p>
                                 </div>
                              </div>
                           </div>

                           {/* Signing Secret */}
                           {selectedHook.secret && (
                              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                 <h3 className="text-sm font-bold text-foreground mb-2 uppercase tracking-wide">Signing Secret</h3>
                                 <p className="text-xs text-muted-foreground mb-4">
                                    Use this secret to verify signatures of incoming webhook requests. Keep this secret secure and never expose it in client-side code.
                                 </p>
                                 <div className="flex gap-2">
                                    <Input 
                                      type={secretVisible ? "text" : "password"} 
                                      value={selectedHook.secret} 
                                      readOnly 
                                      className="flex-1 font-mono" 
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSecretVisible(!secretVisible)}
                                      className="text-xs"
                                    >
                                      {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleCopySecret}
                                      className="text-xs"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                 </div>
                              </div>
                           )}

                           {/* Subscriptions */}
                           <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                              <h3 className="text-sm font-bold text-foreground mb-2 uppercase tracking-wide">Subscribed Events</h3>
                              <p className="text-xs text-muted-foreground mb-4">
                                 Events that trigger webhook deliveries to this endpoint. Only subscribed events will be sent to the configured URL.
                              </p>
                              <div className="space-y-2">
                                 {selectedHook.events.length > 0 ? (
                                    selectedHook.events.map(evt => (
                                       <div 
                                          key={evt} 
                                          className="flex items-center justify-between p-3 border border-border rounded-lg"
                                       >
                                          <span className="text-sm font-mono text-foreground">{evt}</span>
                                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                                       </div>
                                    ))
                                 ) : (
                                    <div className="p-3 text-sm text-muted-foreground">No events subscribed. Edit the webhook to add events.</div>
                                 )}
                              </div>
                           </div>

                           {/* Actions */}
                           <div className="flex gap-4">
                              <Button
                                 variant="outline"
                                 onClick={() => openEditDialog(selectedHook)}
                                 className="flex-1"
                              >
                                 Edit Webhook
                              </Button>
                              <Button
                                 variant="outline"
                                 onClick={() => openLogsDialog(selectedHook)}
                                 className="flex-1"
                              >
                                 View Logs
                              </Button>
                           </div>

                           {/* Danger */}
                           <div className="p-6 border border-destructive/50 bg-destructive/10 rounded-xl flex items-center justify-between">
                              <div>
                                 <h4 className="text-sm font-bold text-destructive">Delete Endpoint</h4>
                                 <p className="text-xs text-destructive/70 mt-1">Permanently delete this webhook endpoint. This action cannot be undone and will stop all future deliveries.</p>
                              </div>
                              <Button
                                 variant="destructive"
                                 size="sm"
                                 onClick={handleDelete}
                                 className="text-xs"
                              >
                                 Delete
                              </Button>
                           </div>

                        </div>
                     )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
    )
}

export default WebhooksPage

