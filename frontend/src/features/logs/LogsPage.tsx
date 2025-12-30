"use client"

import React, { useState } from 'react'
import { 
  Search, 
  Download, 
  Trash2, 
  ArrowUp, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  User, 
  Globe, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Database,
  Terminal
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// --- Types ---

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DEBUG'

interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
  user?: string
  ip?: string
}

// --- Mock Data ---

const LOG_DATA: LogEntry[] = [
  { id: 'log_001', timestamp: '2023-10-27 10:42:15', level: 'ERROR', source: 'API Gateway', message: 'Rate limit exceeded for endpoint /v1/products', ip: '45.22.19.112' },
  { id: 'log_002', timestamp: '2023-10-27 10:41:03', level: 'SUCCESS', source: 'Auth Service', message: 'User login successful', user: 'admin_usr', ip: '192.168.1.5' },
  { id: 'log_003', timestamp: '2023-10-27 10:38:55', level: 'INFO', source: 'System', message: 'Scheduled backup started (Daily_Snapshot_DB)', user: 'system' },
  { id: 'log_004', timestamp: '2023-10-27 10:35:22', level: 'WARN', source: 'License Mgr', message: 'License key validation took > 2000ms', user: 'client_app_v2' },
  { id: 'log_005', timestamp: '2023-10-27 10:30:10', level: 'DEBUG', source: 'Background Worker', message: 'Processing job queue: 124 items pending', user: 'system' },
  { id: 'log_006', timestamp: '2023-10-27 10:28:44', level: 'INFO', source: 'Product Svc', message: 'Product cache invalidated', user: 'admin_usr' },
  { id: 'log_007', timestamp: '2023-10-27 10:25:30', level: 'ERROR', source: 'Database', message: 'Connection pool exhausted, retrying...', ip: 'internal' },
  { id: 'log_008', timestamp: '2023-10-27 10:22:12', level: 'SUCCESS', source: 'Auth Service', message: 'New API Key generated', user: 'dev_team_01', ip: '10.0.0.22' },
  { id: 'log_009', timestamp: '2023-10-27 10:15:00', level: 'INFO', source: 'Webhooks', message: 'Webhook delivery attempt to https://hooks.slack.com/...', user: 'system' },
  { id: 'log_010', timestamp: '2023-10-27 10:10:05', level: 'WARN', source: 'Security', message: 'Multiple failed login attempts detected', ip: '185.200.11.4' },
  { id: 'log_011', timestamp: '2023-10-27 10:05:22', level: 'SUCCESS', source: 'Payments', message: 'Subscription renewed successfully', user: 'client_x99' },
  { id: 'log_012', timestamp: '2023-10-27 10:01:18', level: 'DEBUG', source: 'Analytics', message: 'Flushing event buffer to disk', user: 'system' },
]

export function LogsPage() {
  const [filterLevel, setFilterLevel] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedLogs)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedLogs(newSet)
  }

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLogs(new Set(filteredLogs.map(l => l.id)))
    } else {
      setSelectedLogs(new Set())
    }
  }

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'ERROR': return 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:text-rose-500 dark:border-rose-500/20'
      case 'WARN': return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20'
      case 'SUCCESS': return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500 dark:border-emerald-500/20'
      case 'DEBUG': return 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-500/10 dark:text-purple-500 dark:border-purple-500/20'
      default: return 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:text-blue-500 dark:border-blue-500/20'
    }
  }

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
        case 'ERROR': return <AlertCircle className="size-3" />
        case 'WARN': return <AlertTriangle className="size-3" />
        case 'SUCCESS': return <CheckCircle2 className="size-3" />
        case 'DEBUG': return <Terminal className="size-3" />
        default: return <Info className="size-3" />
    }
  }

  const filteredLogs = LOG_DATA.filter(log => {
    const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.user?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesLevel && matchesSearch
  })

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4 px-4 lg:px-6">
          
          {/* Top Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-background shadow-sm border p-4 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Events Today</div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold">14,205</div>
                <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5">
                    <ArrowUp className="size-3" /> 12%
                </span>
              </div>
            </Card>
            <Card className="bg-background shadow-sm border p-4 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Errors</div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-rose-500">24</div>
                <span className="text-[10px] text-muted-foreground">Past 24h</span>
              </div>
            </Card>
            <Card className="bg-background shadow-sm border p-4 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Warnings</div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-amber-500">156</div>
                <span className="text-[10px] text-muted-foreground">Past 24h</span>
              </div>
            </Card>
            <Card className="bg-background shadow-sm border p-4 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Log Volume</div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold">1.2 GB</div>
                <span className="text-[10px] text-muted-foreground">/ 5 GB Limit</span>
              </div>
            </Card>
          </div>

          {/* Main Logs Panel */}
          <Card className="flex flex-col flex-1 h-[calc(100vh-220px)] min-h-[500px] border bg-background shadow-sm overflow-hidden">
            
            {/* Toolbar */}
            <div className="p-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search logs..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 text-xs pl-8 bg-muted/30 border-muted-foreground/20"
                  />
                </div>
                
                <div className="hidden md:flex bg-muted/30 p-0.5 rounded-lg border border-border/50">
                  {['ALL', 'ERROR', 'WARN', 'INFO'].map(level => (
                    <button 
                      key={level}
                      onClick={() => setFilterLevel(level)}
                      className={cn(
                        "px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wide",
                        filterLevel === level 
                          ? "bg-background shadow-sm text-foreground ring-1 ring-border" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 bg-background">
                  <Download className="size-3" /> Export
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50/50 dark:hover:bg-rose-900/10">
                  <Trash2 className="size-3" /> Clear
                </Button>
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted/30 border-b text-[10px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0 z-10">
                <div className="col-span-1 flex justify-center">
                    <Checkbox 
                        checked={filteredLogs.length > 0 && selectedLogs.size === filteredLogs.length}
                        onCheckedChange={(checked) => toggleSelectAll(checked as boolean)}
                        className="size-3.5"
                    />
                </div>
                <div className="col-span-2">Timestamp</div>
                <div className="col-span-1">Level</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-4">Message</div>
                <div className="col-span-2 text-right">User / IP</div>
            </div>

            {/* Logs List */}
            <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="flex flex-col font-mono text-xs">
                        {filteredLogs.map((log) => (
                            <div 
                                key={log.id} 
                                className={cn(
                                    "grid grid-cols-12 gap-4 px-4 py-2.5 items-center border-b transition-colors hover:bg-muted/40",
                                    selectedLogs.has(log.id) ? "bg-primary/5 hover:bg-primary/10" : "bg-transparent"
                                )}
                            >
                                <div className="col-span-1 flex justify-center">
                                    <Checkbox 
                                        checked={selectedLogs.has(log.id)}
                                        onCheckedChange={() => toggleSelect(log.id)}
                                        className="size-3.5"
                                    />
                                </div>
                                <div className="col-span-2 text-muted-foreground text-[11px]">{log.timestamp}</div>
                                <div className="col-span-1">
                                    <Badge variant="outline" className={cn("text-[9px] px-1.5 h-5 font-bold gap-1 pl-1", getLevelBadge(log.level))}>
                                        {getLevelIcon(log.level)} {log.level}
                                    </Badge>
                                </div>
                                <div className="col-span-2 font-sans font-semibold text-xs">{log.source}</div>
                                <div className="col-span-4 text-muted-foreground truncate" title={log.message}>
                                    {log.message}
                                </div>
                                <div className="col-span-2 text-right text-muted-foreground text-[11px]">
                                    {log.user ? (
                                        <span className="flex items-center justify-end gap-1.5">
                                            <User className="size-3" /> {log.user}
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-end gap-1.5">
                                            <Globe className="size-3" /> {log.ip}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                        {filteredLogs.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                                <Filter className="size-8 mb-3 stroke-1" />
                                <p className="text-xs font-medium">No logs found matching your filters</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>

            {/* Footer */}
            <div className="px-4 py-2 border-t bg-muted/10 flex items-center justify-between text-[10px] text-muted-foreground font-sans">
                 <div>Showing {filteredLogs.length} of {LOG_DATA.length} events</div>
                 <div className="flex items-center gap-2">
                     <Button variant="ghost" size="icon" className="size-6" disabled>
                        <ChevronLeft className="size-3" />
                     </Button>
                     <Separator orientation="vertical" className="h-3" />
                     <Button variant="ghost" size="icon" className="size-6">
                        <ChevronRight className="size-3" />
                     </Button>
                 </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}