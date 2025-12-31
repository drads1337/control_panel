"use client"

import React, { useState } from 'react'
import { 
  Webhook, 
  Plus, 
  Activity, 
  AlertTriangle, 
  Zap, 
  Settings, 
  Trash2, 
  Eye, 
  EyeOff, 
  Copy, 
  Search,
  Send,
  Power,
  CheckCircle2
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// --- Types ---

interface Webhook {
  id: string
  name: string
  url: string
  description: string
  events: string[]
  status: 'active' | 'inactive' | 'failed'
  secret: string
  stats: {
    successRate: number
    totalRequests: number
    avgLatency: number
  }
  created: string
}

interface DeliveryLog {
  id: string
  event: string
  status: number
  timestamp: string
  duration: string
  reqId: string
}

// --- Mock Data ---

const WEBHOOKS: Webhook[] = [
  {
    id: 'wh_prod_main',
    name: 'Production Backend',
    url: 'https://api.acme-corp.com/v1/webhooks/listener',
    description: 'Main integration for order processing and user sync.',
    events: ['order.created', 'order.paid', 'customer.updated'],
    status: 'active',
    secret: 'whsec_rSlK...92mZ',
    stats: { successRate: 99.9, totalRequests: 15402, avgLatency: 145 },
    created: 'Oct 12, 2023'
  },
  {
    id: 'wh_slack_alerts',
    name: 'Ops Slack Alerts',
    url: 'https://hooks.slack.com/services/T000/B000/XXXX',
    description: 'Notifications for system alerts and errors.',
    events: ['system.error', 'billing.failed'],
    status: 'active',
    secret: 'whsec_882k...x99L',
    stats: { successRate: 100, totalRequests: 85, avgLatency: 450 },
    created: 'Nov 01, 2023'
  },
  {
    id: 'wh_staging_test',
    name: 'Staging Sync (Legacy)',
    url: 'https://staging.internal.net/sync',
    description: 'Legacy sync for the old inventory system.',
    events: ['inventory.low'],
    status: 'failed',
    secret: 'whsec_0000...1111',
    stats: { successRate: 45.2, totalRequests: 1205, avgLatency: 2100 },
    created: 'Jan 15, 2023'
  },
  {
    id: 'wh_analytics_collector',
    name: 'Data Lake Collector',
    url: 'https://collector.data.io/ingest',
    description: 'Raw event dump for BI tools.',
    events: ['*'],
    status: 'inactive',
    secret: 'whsec_depr...cated',
    stats: { successRate: 0, totalRequests: 0, avgLatency: 0 },
    created: 'Sep 22, 2023'
  }
]

const LOGS: DeliveryLog[] = [
  { id: 'del_882910', event: 'order.created', status: 200, timestamp: '2023-11-04 14:30:05', duration: '145ms', reqId: 'req_1' },
  { id: 'del_882909', event: 'customer.updated', status: 200, timestamp: '2023-11-04 14:28:12', duration: '120ms', reqId: 'req_2' },
  { id: 'del_882908', event: 'order.paid', status: 502, timestamp: '2023-11-04 14:15:00', duration: '5000ms', reqId: 'req_3' },
  { id: 'del_882907', event: 'order.created', status: 200, timestamp: '2023-11-04 14:10:22', duration: '155ms', reqId: 'req_4' },
  { id: 'del_882906', event: 'system.ping', status: 200, timestamp: '2023-11-04 14:00:00', duration: '90ms', reqId: 'req_5' },
  { id: 'del_882905', event: 'system.ping', status: 429, timestamp: '2023-11-04 13:59:00', duration: '45ms', reqId: 'req_6' },
  { id: 'del_882904', event: 'customer.created', status: 200, timestamp: '2023-11-04 13:45:00', duration: '180ms', reqId: 'req_7' },
]

// --- Sub-components ---

const StatusBadge: React.FC<{ status: number | string, type?: 'http' | 'state' }> = ({ status, type = 'state' }) => {
  if (type === 'http') {
    const code = status as number
    let colorClass = 'bg-muted text-muted-foreground border-border'
    if (code >= 200 && code < 300) colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30'
    if (code >= 400 && code < 500) colorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'
    if (code >= 500) colorClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30'
    
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
      dotColor = 'bg-emerald-500'
      labelColor = 'text-emerald-700 dark:text-emerald-400'
    }
    if (state === 'failed') { 
      dotColor = 'bg-rose-500'
      labelColor = 'text-rose-700 dark:text-rose-400'
    }

    return (
      <div className="flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full", dotColor)}></span>
        <span className={cn("text-xs font-medium capitalize", labelColor)}>{state}</span>
      </div>
    )
  }
}

export function WebhooksPage() {
  const [selectedId, setSelectedId] = useState<string>(WEBHOOKS[0].id)
  const [activeTab, setActiveTab] = useState<'overview' | 'deliveries' | 'settings'>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const selectedHook = WEBHOOKS.find(w => w.id === selectedId) || WEBHOOKS[0]
  const filteredWebhooks = WEBHOOKS.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // In a real app, toast.success("Copied!") would go here
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4 px-4 lg:px-6">
          <div className="mb-2">
            <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
              Webhooks
            </h1>
            <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
              Configure webhook endpoints and monitor delivery status.
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] min-h-[650px] bg-background border border-border rounded-xl overflow-hidden shadow-sm">
            
            {/* LEFT PANE: List */}
            <div className="w-full md:w-[350px] flex flex-col border-r border-border bg-muted/30">
              
              {/* Header / Search */}
              <div className="p-4 border-b border-border bg-background z-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Endpoints</h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input 
                    type="text"
                    placeholder="Filter endpoints..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-background border-border rounded-lg focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>
              </div>

              {/* Scrollable List */}
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {filteredWebhooks.map(hook => (
                    <div 
                      key={hook.id}
                      onClick={() => { setSelectedId(hook.id); setShowSecret(false); }}
                      className={cn(
                        "p-4 border-b border-border cursor-pointer transition-all hover:bg-background",
                        selectedId === hook.id 
                          ? 'bg-background relative after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-primary shadow-sm' 
                          : ''
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h3 className={cn(
                          "text-sm font-bold truncate pr-2",
                          selectedId === hook.id ? 'text-primary' : 'text-foreground'
                        )}>
                          {hook.name}
                        </h3>
                        {hook.status === 'failed' && (
                          <AlertTriangle className="size-4 text-rose-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate font-mono mb-2 opacity-80">
                        {hook.url}
                      </div>
                      <div className="flex items-center justify-between">
                        <StatusBadge status={hook.status} />
                        <span className={cn(
                          "text-[10px] font-bold",
                          hook.stats.successRate > 98 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-500'
                        )}>
                          {hook.stats.successRate}% Success
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* RIGHT PANE: Detail */}
            <div className="flex-1 flex flex-col min-w-0 bg-background">
              
              {/* Detail Header */}
              <div className="px-8 py-6 border-b border-border flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-foreground truncate">{selectedHook.name}</h1>
                    <StatusBadge status={selectedHook.status} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded border border-border w-fit max-w-full">
                    <span className="truncate">{selectedHook.url}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(selectedHook.url)}
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" className="text-xs font-bold">
                    <Power className="size-3 mr-2" /> Disable
                  </Button>
                  <Button size="sm" className="text-xs font-bold">
                    <Send className="size-3 mr-2" /> Send Test
                  </Button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="px-8 flex border-b border-border">
                {(['overview', 'deliveries', 'settings'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "py-3 mr-6 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors",
                      activeTab === tab 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <ScrollArea className="flex-1">
                <div className="p-8 bg-muted/30">
                  
                  {/* OVERVIEW TAB */}
                  {activeTab === 'overview' && (
                    <div className="space-y-8">
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="p-5">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            Success Rate
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className={cn(
                              "text-3xl font-bold",
                              selectedHook.stats.successRate > 98 ? 'text-emerald-500' : 'text-rose-500'
                            )}>
                              {selectedHook.stats.successRate}%
                            </span>
                            <span className="text-xs text-muted-foreground">All time</span>
                          </div>
                        </Card>
                        <Card className="p-5">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            Avg. Latency
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-foreground">{selectedHook.stats.avgLatency}</span>
                            <span className="text-xs text-muted-foreground">ms</span>
                          </div>
                        </Card>
                        <Card className="p-5">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            Total Requests
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-foreground">
                              {(selectedHook.stats.totalRequests / 1000).toFixed(1)}k
                            </span>
                            <span className="text-xs text-muted-foreground">requests</span>
                          </div>
                        </Card>
                      </div>

                      {/* Recent Activity Summary */}
                      <div>
                        <h3 className="text-sm font-bold text-foreground mb-4">Latest Activity</h3>
                        <Card className="overflow-hidden">
                          {LOGS.slice(0, 3).map((log) => (
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
                          <div className="p-3 bg-muted border-t border-border text-center">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-xs font-bold text-primary hover:text-primary"
                              onClick={() => setActiveTab('deliveries')}
                            >
                              View All Deliveries
                            </Button>
                          </div>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* DELIVERIES TAB */}
                  {activeTab === 'deliveries' && (
                    <div className="h-full flex flex-col">
                      <Card className="overflow-hidden flex-1 flex flex-col">
                        <div className="grid grid-cols-12 bg-muted border-b border-border p-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          <div className="col-span-2">Status</div>
                          <div className="col-span-3">Event</div>
                          <div className="col-span-3">ID</div>
                          <div className="col-span-2">Time</div>
                          <div className="col-span-2 text-right">Duration</div>
                        </div>
                        <ScrollArea className="flex-1">
                          {LOGS.map(log => (
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
                          ))}
                        </ScrollArea>
                      </Card>
                    </div>
                  )}

                  {/* SETTINGS TAB */}
                  {activeTab === 'settings' && (
                    <div className="max-w-2xl space-y-8">
                      
                      {/* Basic Info */}
                      <Card className="p-6">
                        <h3 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wide">
                          Endpoint Configuration
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase">
                              Endpoint URL
                            </label>
                            <Input 
                              type="text" 
                              defaultValue={selectedHook.url} 
                              className="w-full bg-background border-border rounded-lg p-2.5 text-sm font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase">
                              Description
                            </label>
                            <Input 
                              type="text" 
                              defaultValue={selectedHook.description} 
                              className="w-full bg-background border-border rounded-lg p-2.5 text-sm"
                            />
                          </div>
                        </div>
                      </Card>

                      {/* Signing Secret */}
                      <Card className="p-6">
                        <h3 className="text-sm font-bold text-foreground mb-2 uppercase tracking-wide">
                          Signing Secret
                        </h3>
                        <p className="text-xs text-muted-foreground mb-4">
                          Use this secret to verify signatures of incoming webhook requests.
                        </p>
                        <div className="flex gap-2">
                          <Input 
                            type={showSecret ? "text" : "password"} 
                            value={selectedHook.secret} 
                            readOnly 
                            className="flex-1 bg-muted border-border rounded-lg p-2.5 text-sm font-mono text-muted-foreground"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs font-bold"
                            onClick={() => setShowSecret(!showSecret)}
                          >
                            {showSecret ? 'Hide' : 'Reveal'}
                          </Button>
                        </div>
                      </Card>

                      {/* Subscriptions */}
                      <Card className="p-6">
                        <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide">
                          Events
                        </h3>
                        <div className="space-y-2">
                          {['order.created', 'order.paid', 'customer.created', 'system.error'].map(evt => (
                            <label 
                              key={evt} 
                              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer"
                            >
                              <span className="text-sm font-mono text-foreground">{evt}</span>
                              <input 
                                type="checkbox" 
                                defaultChecked={selectedHook.events.includes(evt) || selectedHook.events.includes('*')} 
                                className="rounded border-border text-primary focus:ring-0 w-4 h-4"
                              />
                            </label>
                          ))}
                        </div>
                      </Card>

                      {/* Danger */}
                      <Card className="p-6 border-rose-200 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-900/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400">Delete Endpoint</h4>
                            <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">
                              This action cannot be undone.
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-xs font-bold"
                          >
                            Delete
                          </Button>
                        </div>
                      </Card>

                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}