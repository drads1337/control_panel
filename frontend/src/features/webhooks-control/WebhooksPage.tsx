"use client"

import React, { useState } from 'react'
import { 
  Webhook, 
  Plus, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  Settings, 
  Trash2, 
  Eye, 
  EyeOff, 
  Copy, 
  Filter, 
  RefreshCw,
  Search,
  Globe,
  Clock,
  ArrowRight
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// --- Types ---

interface WebhookData {
  id: string
  name: string
  url: string
  events: string[]
  status: 'active' | 'inactive' | 'error'
  secret: string
  stats: {
    successRate: number
    deliveries: number
    latency: number
  }
  lastDelivery: string
}

interface LogEntry {
  id: string
  event: string
  status: number
  timestamp: string
  latency: string
}

// --- Mock Data ---

const WEBHOOKS: WebhookData[] = [
  {
    id: 'wh_01',
    name: 'Main Application Backend',
    url: 'https://api.myapp.com/webhooks/v1/listener',
    events: ['license.created', 'license.revoked', 'user.signup'],
    status: 'active',
    secret: 'whsec_5f9a2b8c9d1e2f3g4h5i6j7k8l9m0n1o',
    stats: { successRate: 98.5, deliveries: 1240, latency: 245 },
    lastDelivery: '2 mins ago'
  },
  {
    id: 'wh_02',
    name: 'Discord Alerts',
    url: 'https://discord.com/api/webhooks/11029384756...',
    events: ['alert.security', 'system.error'],
    status: 'active',
    secret: 'whsec_x992288337711...',
    stats: { successRate: 100, deliveries: 45, latency: 120 },
    lastDelivery: '1 hour ago'
  },
  {
    id: 'wh_03',
    name: 'Legacy CRM Sync',
    url: 'https://crm.internal.net/sync',
    events: ['user.updated'],
    status: 'error',
    secret: 'whsec_001122334455...',
    stats: { successRate: 42.1, deliveries: 890, latency: 1200 },
    lastDelivery: '5 mins ago'
  }
]

const LOGS: LogEntry[] = [
  { id: 'evt_1', event: 'license.created', status: 200, timestamp: '14:30:05', latency: '240ms' },
  { id: 'evt_2', event: 'user.signup', status: 200, timestamp: '14:28:12', latency: '180ms' },
  { id: 'evt_3', event: 'license.revoked', status: 500, timestamp: '14:15:00', latency: '5000ms' },
  { id: 'evt_4', event: 'license.created', status: 200, timestamp: '14:10:22', latency: '210ms' },
  { id: 'evt_5', event: 'system.ping', status: 200, timestamp: '14:00:00', latency: '150ms' },
  { id: 'evt_6', event: 'alert.security', status: 400, timestamp: '13:55:10', latency: '90ms' },
  { id: 'evt_7', event: 'user.updated', status: 200, timestamp: '13:45:00', latency: '120ms' },
]

export function WebhooksPage() {
  const [selectedHook, setSelectedHook] = useState<WebhookData>(WEBHOOKS[0])
  const [showSecret, setShowSecret] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
      case 'inactive': return 'text-muted-foreground bg-muted border-border'
      case 'error': return 'text-rose-500 bg-rose-500/10 border-rose-500/20'
      default: return 'text-muted-foreground'
    }
  }

  const getStatusCodeBadge = (code: number) => {
    if (code >= 200 && code < 300) return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500 dark:border-emerald-500/20'
    if (code >= 400 && code < 500) return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20'
    return 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:text-rose-500 dark:border-rose-500/20'
  }

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
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-140px)] min-h-[650px]">
            
            {/* LEFT COLUMN: Webhook List */}
            <Card className="lg:col-span-4 flex flex-col border bg-background shadow-sm overflow-hidden">
              <CardHeader className="p-3 border-b space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Webhook className="size-3 text-primary" />
                        <CardTitle className="text-xs font-bold uppercase tracking-wide">Endpoints</CardTitle>
                    </div>
                    <Button size="sm" className="h-7 text-xs gap-1 px-2.5">
                        <Plus className="size-3" /> New
                    </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                  <Input 
                    placeholder="Filter endpoints..." 
                    className="h-7 text-xs pl-8 bg-muted/30 border-muted-foreground/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="flex flex-col p-2 gap-2">
                    {WEBHOOKS.map(hook => (
                      <button
                        key={hook.id}
                        onClick={() => { setSelectedHook(hook); setShowSecret(false); }}
                        className={cn(
                          "flex flex-col gap-2 p-3 rounded-md border text-left transition-all hover:bg-muted/30",
                          selectedHook.id === hook.id 
                            ? "bg-accent/50 border-primary/50 ring-1 ring-primary/20" 
                            : "bg-background border-border"
                        )}
                      >
                        <div className="flex justify-between items-start w-full">
                            <div className="flex items-center gap-2">
                                <span className={cn("size-2 rounded-full", 
                                    hook.status === 'active' ? 'bg-emerald-500' : 
                                    hook.status === 'error' ? 'bg-rose-500 animate-pulse' : 'bg-muted-foreground'
                                )} />
                                <span className="text-xs font-semibold">{hook.name}</span>
                            </div>
                            {hook.status === 'error' && <AlertTriangle className="size-3 text-rose-500" />}
                        </div>
                        
                        <div className="flex items-center gap-1.5 w-full bg-muted/50 p-1.5 rounded border border-border/50">
                            <Badge variant="outline" className="text-xs h-5 px-1.5 rounded-[3px] bg-background border-border text-muted-foreground font-mono">POST</Badge>
                            <span className="text-xs font-mono text-muted-foreground truncate flex-1">{hook.url}</span>
                        </div>

                        <div className="flex flex-wrap gap-1">
                            {hook.events.slice(0, 3).map(evt => (
                                <span key={evt} className="text-xs px-1.5 py-0.5 bg-muted rounded-sm border text-muted-foreground font-medium">
                                    {evt}
                                </span>
                            ))}
                            {hook.events.length > 3 && (
                                <span className="text-xs px-1.5 py-0.5 text-muted-foreground">+{hook.events.length - 3}</span>
                            )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* RIGHT COLUMN: Details & Logs */}
            <div className="lg:col-span-8 flex flex-col gap-4 min-w-0">
                
                {/* Header Card */}
                <Card className="shrink-0 border bg-background shadow-sm">
                    <CardHeader className="p-3 pb-0 flex flex-row items-start justify-between space-y-0">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-semibold">{selectedHook.name}</h2>
                                <Badge variant="outline" className={cn("text-xs h-5 px-1.5 uppercase", getStatusColor(selectedHook.status))}>
                                    {selectedHook.status}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                                <Globe className="size-3" />
                                {selectedHook.url}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                                <Zap className="size-3 text-amber-500" /> Test
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
                                <Settings className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-rose-500">
                                <Trash2 className="size-3.5" />
                            </Button>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="p-3">
                        {/* Secret Field */}
                        <div className="flex items-center gap-3 p-1.5 pl-3 pr-1.5 rounded-md border bg-muted/20">
                            <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                                <Zap className="size-3" />
                                <span className="text-xs font-bold uppercase tracking-wide">Signing Secret</span>
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                            <Input 
                                type={showSecret ? "text" : "password"} 
                                value={selectedHook.secret}
                                readOnly
                                className="border-0 bg-transparent h-7 text-xs font-mono focus-visible:ring-0 px-0 shadow-none flex-1 text-foreground"
                            />
                            <div className="flex gap-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="size-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowSecret(!showSecret)}
                                >
                                    {showSecret ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="size-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => copyToClipboard(selectedHook.secret)}
                                >
                                    <Copy className="size-3" />
                                </Button>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="p-3 rounded-md border bg-card flex flex-col items-center justify-center gap-1 shadow-sm">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Success Rate</span>
                                <div className={cn("text-xl font-semibold tabular-nums", selectedHook.stats.successRate > 98 ? 'text-emerald-500' : 'text-amber-500')}>
                                    {selectedHook.stats.successRate}%
                                </div>
                            </div>
                            <div className="p-3 rounded-md border bg-card flex flex-col items-center justify-center gap-1 shadow-sm">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Deliveries</span>
                                <div className="text-xl font-semibold tabular-nums">{selectedHook.stats.deliveries.toLocaleString()}</div>
                            </div>
                            <div className="p-3 rounded-md border bg-card flex flex-col items-center justify-center gap-1 shadow-sm">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avg Latency</span>
                                <div className="text-xl font-semibold tabular-nums">{selectedHook.stats.latency}ms</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Logs Table */}
                <Card className="flex flex-col flex-1 border bg-background shadow-sm overflow-hidden">
                    <CardHeader className="p-3 border-b bg-muted/10 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <Activity className="size-3 text-muted-foreground" />
                            <CardTitle className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Delivery History</CardTitle>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2 border-dashed">
                                <Filter className="size-3" /> Filter
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 text-primary hover:text-primary hover:bg-primary/10">
                                <RefreshCw className="size-3" /> Live
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-muted/30 sticky top-0 z-10 text-xs font-bold uppercase text-muted-foreground tracking-wider">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">Status</th>
                                        <th className="px-4 py-2 font-medium">Event</th>
                                        <th className="px-4 py-2 font-medium">ID</th>
                                        <th className="px-4 py-2 font-medium text-right">Timing</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {LOGS.map((log) => (
                                        <tr key={log.id} className="group hover:bg-muted/30 transition-colors cursor-default">
                                            <td className="px-4 py-2.5">
                                                <Badge variant="outline" className={cn("text-xs px-1.5 h-5 font-mono font-normal border", getStatusCodeBadge(log.status))}>
                                                    {log.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className="text-xs font-medium group-hover:text-primary transition-colors">{log.event}</span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className="text-xs font-mono text-muted-foreground">{log.id}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="text-xs font-bold font-mono">{log.latency}</span>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        {log.timestamp}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ScrollArea>
                    </CardContent>
                </Card>

            </div>

          </div>
        </div>
      </div>
    </div>
  )
}