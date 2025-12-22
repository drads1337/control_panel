import React, { useState, useCallback, useMemo, useRef } from 'react'
import { Skeleton } from '@/shared/ui/components/skeleton'
import { Input } from '@/shared/ui/components/input'
import { Button } from '@/shared/ui/components/button'
import { Badge } from '@/shared/ui/components/badge'
import { Separator } from '@/shared/ui/components/separator'
import { 
  useLogsQuery, 
  useLogActions,
  type Log
} from '@/entities/log'
import { cn } from '@/shared/lib/utils/utils'
import { 
  Search, 
  Download, 
  RefreshCw, 
  ChevronDown,
  ChevronUp,
  Settings,
  Copy,
  Network,
  MoreHorizontal
} from 'lucide-react'

export function LogsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const expandedRowsOrderRef = useRef<string[]>([])
  const [levelFilter, setLevelFilter] = useState<string>('ALL')
  
  const {
    logs,
    loading,
    pagination,
    searchLogsByTerm,
    changePage,
    changePerPage,
    refresh,
    fetchLogs
  } = useLogsQuery({
    page: 1,
    perPage: 50,
  })

  const { exportLogsToCSV, isExporting } = useLogActions()

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value
    setSearchTerm(term)
    if (term.trim()) {
      searchLogsByTerm(term)
    } else {
      fetchLogs()
    }
  }, [searchLogsByTerm, fetchLogs])

  const handleExport = useCallback(async () => {
    try {
      await exportLogsToCSV({})
    } catch (error) {
      console.error('Export failed:', error)
    }
  }, [exportLogsToCSV])

  const handleRefresh = useCallback(() => {
    refresh()
  }, [refresh])

  const handlePageChange = useCallback((page: number) => {
    changePage(page)
  }, [changePage])

  const handlePerPageChange = useCallback((perPage: number) => {
    changePerPage(perPage)
  }, [changePerPage])

  // Format log level
  const getLogLevel = useCallback((action: string | null | undefined) => {
    if (!action) return 'INFO'
    const actionLower = action.toLowerCase()
    if (actionLower.includes('error') || actionLower.includes('fail') || actionLower.includes('critical')) return 'CRITICAL'
    if (actionLower.includes('warn')) return 'WARNING'
    if (actionLower.includes('debug')) return 'DEBUG'
    return 'INFO'
  }, [])

  // Format log color
  const getLogColor = useCallback((level: string) => {
    switch (level) {
      case 'ERROR':
      case 'CRITICAL':
        return { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' }
      case 'WARNING':
        return { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' }
      case 'DEBUG':
        return { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' }
      default:
        return { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
    }
  }, [])

  // Get service name from log
  const getServiceName = useCallback((log: Log) => {
    if (log.action) {
      const actionLower = log.action.toLowerCase()
      if (actionLower.includes('auth') || actionLower.includes('login') || actionLower.includes('session')) return 'auth-service'
      if (actionLower.includes('key') || actionLower.includes('license')) return 'license-manager'
      if (actionLower.includes('connection') || actionLower.includes('connect')) return 'api-gateway'
      if (actionLower.includes('notification') || actionLower.includes('email')) return 'notification-worker'
    }
    return 'api-service'
  }, [])

  // Format metadata as JSON
  const formatMetadata = useCallback((log: Log) => {
    const metadata: Record<string, any> = {}
    
    metadata.action = log.action
    if (log.user_agent) metadata.user_agent = log.user_agent
    
    if (log.details) {
      try {
        const parsed = JSON.parse(log.details)
        return JSON.stringify({ ...metadata, ...parsed }, null, 2)
      } catch {
        metadata.details = log.details
      }
    }
    
    if (log.ip_address) metadata.ip_address = log.ip_address
    if (log.country) metadata.country = log.country
    if (log.city) metadata.city = log.city
    
    return JSON.stringify(metadata, null, 2)
  }, [])

  // Copy metadata to clipboard
  const copyMetadata = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [])

  // Filter logs by level
  const filteredLogs = useMemo(() => {
    if (levelFilter === 'ALL') return logs
    return logs.filter(log => {
      const level = getLogLevel(log.action)
      return level === levelFilter
    })
  }, [logs, levelFilter, getLogLevel])

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        // Close the row
        newSet.delete(id)
        expandedRowsOrderRef.current = expandedRowsOrderRef.current.filter(rowId => rowId !== id)
        return newSet
      } else {
        // Open the row - check if we need to remove oldest
        if (newSet.size >= 5) {
          const oldestId = expandedRowsOrderRef.current[0]
          if (oldestId && newSet.has(oldestId)) {
            newSet.delete(oldestId)
            expandedRowsOrderRef.current = [...expandedRowsOrderRef.current.slice(1), id]
          } else {
            expandedRowsOrderRef.current = [...expandedRowsOrderRef.current, id]
          }
        } else {
          expandedRowsOrderRef.current = [...expandedRowsOrderRef.current, id]
        }
        newSet.add(id)
        return newSet
      }
    })
  }, [])

  // Format timestamp
  const formatTimestamp = useCallback((dateString: string | null) => {
    if (!dateString) return 'N/A N/A'
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
  }, [])

  const skeletonRows = useMemo(() => Array.from({ length: 10 }, (_, i) => i), [])

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-background-dark border border-border-dark rounded-sm overflow-hidden shadow-2xl relative font-mono text-sm">
      {/* Top Bar: Controls */}
      <div className="h-14 px-4 py-2 border-b border-border-dark bg-[#12141a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative group w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <Search className="h-3.5 w-3.5 text-text-secondary-dark group-focus-within:text-primary transition-colors" />
            </span>
            <Input 
              className="w-full bg-background-dark border border-border-dark rounded-sm pl-9 pr-3 py-1.5 text-[10px] text-text-secondary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark/40 h-auto" 
              placeholder="Search logs (e.g. error AND service:auth)..." 
              type="text"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          <Separator orientation="vertical" className="h-6 bg-border-dark/50" />
          {/* Level Filters */}
          <div className="flex items-center gap-1">
            {['ALL', 'CRITICAL', 'WARNING', 'INFO', 'DEBUG'].map((f) => (
              <Button
                key={f}
                onClick={() => setLevelFilter(f)}
                variant={levelFilter === f ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider h-auto",
                  levelFilter === f 
                    ? 'bg-primary text-background-dark border-primary' 
                    : 'bg-transparent text-text-secondary-dark border-transparent hover:bg-white/5 hover:text-white'
                )}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
            <span className="relative flex h-2 w-2">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75", !loading && "hidden")}></span>
              <span className={cn("relative inline-flex rounded-full h-2 w-2 bg-emerald-500", !loading && "bg-text-secondary-dark")}></span>
            </span>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live Tail</span>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="ghost"
            size="icon"
            className="text-text-secondary-dark hover:text-white h-auto w-auto p-0"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            variant="ghost"
            size="icon"
            className="text-text-secondary-dark hover:text-white h-auto w-auto p-0"
            title="Export"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-text-secondary-dark hover:text-white h-auto w-auto p-0"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 px-4 py-2 border-b border-border-dark bg-[#161920] text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest shrink-0">
        <div className="col-span-2">Timestamp</div>
        <div className="col-span-1">Level</div>
        <div className="col-span-2">Service</div>
        <div className="col-span-5">Message</div>
        <div className="col-span-1">Latency</div>
        <div className="col-span-1 text-right">Trace</div>
      </div>

      {/* Log Stream */}
      <div className="flex-1 overflow-y-auto bg-[#0a0c10] custom-scrollbar">
        {loading ? (
          <div className="p-4 space-y-2">
            {skeletonRows.map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse border-b border-border-dark/30 py-2.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-secondary-dark">
            No logs found
          </div>
        ) : (
          filteredLogs.map((log, i) => {
            const logId = String(log.id || i)
            const isExpanded = expandedRows.has(logId)
            const level = getLogLevel(log.action)
            const { color, bg, border } = getLogColor(level)
            const serviceName = getServiceName(log)
            const timestamp = formatTimestamp(log.created_at)
            const [datePart, timePart] = timestamp.includes(' ') ? timestamp.split(' ') : ['N/A', 'N/A']
            const metadata = formatMetadata(log)
            
            return (
              <div key={logId} className="border-b border-border-dark/30 group">
                {/* Row Main Content */}
                <div 
                  onClick={() => toggleRow(logId)}
                  className={cn(
                    "grid grid-cols-12 px-4 py-2.5 items-center cursor-pointer transition-colors text-[11px] hover:bg-white/5",
                    isExpanded ? 'bg-[#1a1d24]' : '',
                    level === 'CRITICAL' && "border-l-2 border-l-red-500/50 bg-red-500/5"
                  )}
                >
                  <div className="col-span-2 text-text-secondary-dark font-mono opacity-80">
                    {timePart} <span className="text-[9px] opacity-50 ml-1">{datePart}</span>
                  </div>
                  <div className="col-span-1">
                    <Badge 
                      variant="outline"
                      className={cn("px-1.5 py-0.5 rounded-[2px] font-bold uppercase text-[9px] tracking-wider", bg, color, border)}
                    >
                      {level}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-white font-medium truncate pr-2" title={serviceName}>{serviceName}</div>
                  <div className={cn(
                    "col-span-5 truncate pr-4",
                    level === 'CRITICAL' ? 'text-red-200' : 'text-text-secondary-dark group-hover:text-gray-300'
                  )}>
                    {log.action || log.details || 'No message'}
                  </div>
                  <div className="col-span-1 text-text-secondary-dark opacity-60">-</div>
                  <div className="col-span-1 text-right flex justify-end gap-2 items-center">
                    <span className="text-text-secondary-dark opacity-40 font-mono text-[10px]">tr_{String(log.id).slice(-6)}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-text-secondary-dark" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-text-secondary-dark" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="bg-[#050608] border-y border-border-dark p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-6">
                      {/* Metadata Columns */}
                      <div className="w-48 shrink-0 space-y-4 border-r border-border-dark/50 pr-4">
                        <div>
                          <div className="text-[9px] text-text-secondary-dark uppercase tracking-wider mb-1">User</div>
                          <div className="text-xs text-white font-mono">{log.username || '-'}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-text-secondary-dark uppercase tracking-wider mb-1">IP Address</div>
                          <div className="text-xs text-white font-mono flex items-center gap-2">
                            {log.ip_address || '-'}
                            <Network className="h-3.5 w-3.5 text-text-secondary-dark" />
                          </div>
                        </div>
                        {log.country && (
                          <div>
                            <div className="text-[9px] text-text-secondary-dark uppercase tracking-wider mb-1">Location</div>
                            <div className="text-xs text-white font-mono">
                              {log.country}{log.city ? `, ${log.city}` : ''}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-[9px] text-text-secondary-dark uppercase tracking-wider mb-1">Full Timestamp</div>
                          <div className="text-xs text-white font-mono">{timestamp}</div>
                        </div>
                      </div>

                      {/* Code Viewer */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-bold">Metadata Payload</span>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              copyMetadata(metadata)
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-[10px] text-primary hover:underline h-auto px-0 py-0"
                          >
                            <Copy className="h-3.5 w-3.5" /> Copy JSON
                          </Button>
                        </div>
                        <div className="bg-[#0f1115] border border-border-dark rounded p-3 overflow-x-auto">
                          <pre className="text-[10px] leading-relaxed font-mono text-gray-400">
                            {metadata.split('\n').map((line, idx) => (
                              <div key={idx} className="table-row">
                                <span className="table-cell select-none text-gray-700 w-8 text-right pr-3">{idx + 1}</span>
                                <span className="table-cell" dangerouslySetInnerHTML={{ 
                                  __html: line
                                    .replace(/"([^"]+)":/g, '<span class="text-blue-400">"$1"</span>:')
                                    .replace(/: "([^"]+)"/g, ': <span class="text-emerald-400">"$1"</span>')
                                    .replace(/: ([0-9]+)/g, ': <span class="text-orange-400">$1</span>')
                                }} />
                              </div>
                            ))}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
        {/* Fake infinite scroll loader */}
        {!loading && filteredLogs.length > 0 && (
          <div className="py-4 text-center">
            <MoreHorizontal className="h-5 w-5 text-text-secondary-dark opacity-20 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  )
}

