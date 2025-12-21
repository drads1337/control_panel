import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/components/card'
import { Separator } from '@/shared/ui/components/separator'
import { Skeleton } from '@/shared/ui/components/skeleton'
import { Spinner } from '@/shared/ui/components/spinner'
import { useLogsQuery } from '@/entities/log'
import { cn } from '@/shared/lib/utils/utils'

export function LogsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('All Levels')
  const [sourceFilter, setSourceFilter] = useState('All Sources')
  
  const { logs, loading, stats, pagination, searchLogsByTerm } = useLogsQuery({
    page: 1,
    perPage: 50,
  })

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value
    setSearchTerm(term)
    if (term.trim()) {
      searchLogsByTerm(term)
    }
  }

  // Mock data structure for skeleton
  const skeletonRows = Array.from({ length: 10 }, (_, i) => i)

  // Format log level
  const getLogLevel = (action: string) => {
    if (action.toLowerCase().includes('error') || action.toLowerCase().includes('fail')) return 'ERROR'
    if (action.toLowerCase().includes('warn')) return 'WARN'
    if (action.toLowerCase().includes('debug')) return 'DEBUG'
    return 'INFO'
  }

  // Format log color
  const getLogColor = (level: string) => {
    switch (level) {
      case 'ERROR':
      case 'CRIT':
        return { color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' }
      case 'WARN':
        return { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' }
      case 'DEBUG':
        return { color: 'text-text-secondary-dark', bg: 'bg-white/5 border-white/10' }
      default:
        return { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' }
    }
  }

  // Format timestamp
  const formatTimestamp = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).replace(',', '')
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
       <div className="flex flex-wrap items-center gap-2 py-1">
            <div className="relative flex-grow max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-text-secondary-dark text-sm">filter_alt</span>
                </span>
                <input 
                  className="pl-9 pr-4 py-1.5 bg-surface-dark border border-border-dark rounded text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary w-full placeholder-text-secondary-dark transition-all font-mono-numbers" 
                  placeholder="Filter by keyword, service, or trace ID..." 
                  type="text"
                  value={searchTerm}
                  onChange={handleSearch}
                />
                {loading && (
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Spinner size="sm" />
                  </span>
                )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
                <span className="text-[10px] text-text-secondary-dark font-mono-numbers uppercase tracking-wider mr-2">
                  {loading ? (
                    <Skeleton className="h-3 w-32" />
                  ) : (
                    `Showing ${logs.length} of ${pagination.total || 0} events`
                  )}
                </span>
                <select 
                  className="bg-surface-dark border border-border-dark text-text-secondary-dark text-[10px] rounded px-2 py-1.5 hover:border-primary focus:ring-0 focus:border-primary transition-colors uppercase tracking-wide cursor-pointer"
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                >
                    <option>All Levels</option>
                    <option>Error</option>
                    <option>Warning</option>
                    <option>Info</option>
                    <option>Debug</option>
                </select>
                 <select 
                  className="bg-surface-dark border border-border-dark text-text-secondary-dark text-[10px] rounded px-2 py-1.5 hover:border-primary focus:ring-0 focus:border-primary transition-colors uppercase tracking-wide cursor-pointer"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                    <option>All Sources</option>
                    <option>API Gateway</option>
                    <option>Auth Service</option>
                    <option>Database</option>
                </select>
            </div>
       </div>

       <Card className="bg-surface-dark border-border-dark rounded overflow-hidden flex flex-col h-[600px] shadow-sm relative">
            <div className="flex items-center justify-between px-4 py-2 bg-background-dark/50 border-b border-border-dark text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold select-none">
                 <div className="flex items-center gap-8 w-full">
                    <span className="w-32">Timestamp</span>
                    <span className="w-20">Level</span>
                    <span className="w-32">Service</span>
                    <span className="flex-1">Message</span>
                    <span className="w-24 text-right">Trace ID</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-auto p-0 font-mono text-xs">
                 {loading ? (
                   <div className="p-4 space-y-2">
                     {skeletonRows.map((i) => (
                       <div key={i} className="flex items-center gap-4 animate-pulse">
                         <Skeleton className="h-8 w-32" />
                         <Skeleton className="h-6 w-20" />
                         <Skeleton className="h-6 w-32" />
                         <Skeleton className="h-6 flex-1" />
                         <Skeleton className="h-6 w-24" />
                       </div>
                     ))}
                   </div>
                 ) : (
                   <table className="w-full text-left border-collapse">
                     <tbody className="divide-y divide-white/5">
                       {logs.length === 0 ? (
                         <tr>
                           <td colSpan={5} className="px-4 py-8 text-center text-text-secondary-dark">
                             No logs found
                           </td>
                         </tr>
                       ) : (
                         logs.map((log, i) => {
                           const level = getLogLevel(log.action)
                           const { color, bg } = getLogColor(level)
                           const isError = level === 'ERROR'
                           
                           return (
                             <tr 
                               key={log.id || i} 
                               className={cn(
                                 "group hover:bg-white/5 transition-colors cursor-pointer",
                                 isError && "border-l-2 border-l-red-500/50 bg-red-500/5"
                               )}
                             >
                               <td className="px-4 py-2 whitespace-nowrap text-text-secondary-dark font-mono-numbers opacity-70 w-32 align-top">
                                 {formatTimestamp(log.created_at)}
                               </td>
                               <td className="px-4 py-2 whitespace-nowrap w-20 align-top">
                                 <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border", bg, color)}>
                                   {level}
                                 </span>
                               </td>
                               <td className="px-4 py-2 whitespace-nowrap text-primary w-32 align-top">
                                 {log.action || 'N/A'}
                               </td>
                               <td className={cn(
                                 "px-4 py-2 break-all align-top",
                                 level === 'DEBUG' || level === 'WARN' ? 'text-text-secondary-dark' : 'text-text-primary-dark'
                               )}>
                                 {log.details || log.action || 'No details'}
                               </td>
                               <td className="px-4 py-2 whitespace-nowrap text-text-secondary-dark font-mono-numbers text-right w-24 align-top opacity-50 group-hover:opacity-100">
                                 #{log.id}
                               </td>
                             </tr>
                           )
                         })
                       )}
                     </tbody>
                   </table>
                 )}
            </div>
             <div className="h-8 bg-background-dark/80 border-t border-border-dark flex items-center px-4 justify-between">
                <div className="flex items-center gap-2 w-full max-w-2xl">
                     <button className="text-text-secondary-dark hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-sm">skip_previous</span>
                    </button>
                    <button className="text-text-secondary-dark hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-sm">play_arrow</span>
                    </button>
                    <div className="flex-1 h-1 bg-white/10 rounded-full relative group cursor-pointer">
                        <div className="absolute inset-y-0 left-0 bg-primary w-[75%] rounded-full group-hover:bg-primary-hover transition-colors"></div>
                        <div className="absolute top-1/2 -translate-y-1/2 left-[75%] w-2 h-2 bg-primary rounded-full shadow-glow"></div>
                    </div>
                    <span className="text-[10px] text-text-secondary-dark font-mono-numbers whitespace-nowrap">Live Tail</span>
                </div>
                <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] text-text-secondary-dark uppercase tracking-wide">Connected</span>
                    </div>
                </div>
            </div>
       </Card>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-4">
            <Card className="bg-surface-dark border-border-dark rounded p-4 flex items-center justify-between relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
                <div className="flex flex-col">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Error Rate</span>
                    {loading ? (
                      <Skeleton className="h-6 w-16 mt-1" />
                    ) : (
                      <span className="text-lg font-mono-numbers text-text-primary-dark">
                        {stats?.overview ? `${((stats.overview.total - (stats.overview.total - stats.overview.today)) / stats.overview.total * 100).toFixed(2)}%` : '0.04%'}
                      </span>
                    )}
                </div>
                 <div className="h-8 w-16 opacity-50">
                    <div className="flex items-end justify-between h-full gap-0.5">
                        {loading ? (
                          <Skeleton className="w-1 h-full" />
                        ) : (
                          [20, 40, 80, 30, 20, 10].map((h, i) => (
                             <div key={i} className={`w-1 ${h > 50 ? 'bg-red-500/50' : 'bg-white/10'}`} style={{ height: `${h}%` }}></div>
                          ))
                        )}
                    </div>
                </div>
            </Card>
             <Card className="bg-surface-dark border-border-dark rounded p-4 flex items-center justify-between relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
                <div className="flex flex-col">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Log Volume</span>
                    {loading ? (
                      <Skeleton className="h-6 w-16 mt-1" />
                    ) : (
                      <span className="text-lg font-mono-numbers text-text-primary-dark">
                        {stats?.overview?.today || 0}/s
                      </span>
                    )}
                </div>
                 <div className="h-8 w-16 opacity-50">
                    <div className="flex items-end justify-between h-full gap-0.5">
                        {loading ? (
                          <Skeleton className="w-1 h-full" />
                        ) : (
                          [40, 60, 50, 90, 70, 50].map((h, i) => (
                             <div key={i} className={`w-1 ${h > 80 ? 'bg-primary/50' : 'bg-white/10'}`} style={{ height: `${h}%` }}></div>
                          ))
                        )}
                    </div>
                </div>
            </Card>
             <Card className="bg-surface-dark border-border-dark rounded p-4 flex items-center justify-between relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
                <div className="flex flex-col">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Total Logs</span>
                    {loading ? (
                      <Skeleton className="h-6 w-16 mt-1" />
                    ) : (
                      <span className="text-lg font-mono-numbers text-text-primary-dark">
                        {stats?.overview?.total?.toLocaleString() || '0'}
                      </span>
                    )}
                </div>
                <span className="material-symbols-outlined text-text-secondary-dark opacity-30 text-2xl">sd_storage</span>
            </Card>
             <Card className="bg-surface-dark border-border-dark rounded p-4 flex items-center justify-between relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
                <div className="flex flex-col">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">This Week</span>
                    {loading ? (
                      <Skeleton className="h-6 w-16 mt-1" />
                    ) : (
                      <span className="text-lg font-mono-numbers text-text-primary-dark">
                        {stats?.overview?.week?.toLocaleString() || '0'}
                      </span>
                    )}
                </div>
                <span className="material-symbols-outlined text-text-secondary-dark opacity-30 text-2xl">history</span>
            </Card>
       </div>

       <div className="relative flex justify-between items-center pt-6 pb-2 text-[10px] text-text-secondary-dark mt-8 uppercase tracking-widest opacity-60">
            <Separator className="absolute top-0 left-0 right-0 border-border-dark" />
        <p>© 2025 SAAS MGR</p>
        <p className="font-mono-numbers">V.1.0.0-BETA</p>
      </div>
    </div>
  )
}

