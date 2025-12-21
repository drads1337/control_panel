import React from 'react'
import { Search, Filter, RefreshCw, Plus, Monitor, Network, Terminal, Laptop, MoreVertical } from 'lucide-react'

export function AgentsPage() {
  return (
    <div className="space-y-5">
      
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 mb-2">
            <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-text-secondary-dark group-focus-within:text-primary transition-colors" />
                </span>
                <input className="pl-9 pr-4 py-1.5 bg-surface-dark border border-border-dark rounded text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary w-64 placeholder-text-secondary-dark transition-all shadow-sm" placeholder="Filter agents by ID, IP or tag..." type="text"/>
            </div>
             <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-surface-dark border border-border-dark hover:border-text-secondary-dark rounded text-xs font-medium text-text-secondary-dark hover:text-text-primary-dark transition-colors flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">FILTER</span>
                </button>
                 <button className="px-3 py-1.5 bg-surface-dark border border-border-dark hover:border-text-secondary-dark rounded text-xs font-medium text-text-secondary-dark hover:text-text-primary-dark transition-colors flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>
                 <button className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-background-dark rounded text-xs font-bold transition-all shadow-glow flex items-center gap-2">
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">ADD AGENT</span>
                </button>
            </div>
       </div>

       <div className="space-y-2">
           {/* Node 1 */}
            <div className="bg-surface-dark border border-border-dark rounded p-3 flex flex-col md:flex-row md:items-center justify-between hover:border-primary/50 transition-all group relative overflow-hidden gap-4 md:gap-0">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-success/80"></div>
                <div className="flex items-center gap-4 pl-2">
                    <div className="w-9 h-9 rounded bg-background-dark border border-border-dark flex items-center justify-center relative">
                        <Monitor className="h-4 w-4 text-text-secondary-dark" />
                        <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-success border border-background-dark"></span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-text-primary-dark tracking-wide">NODE_ALPHA_01</h3>
                            <span className="text-[9px] px-1.5 py-px rounded-full bg-success/10 text-success border border-success/20 font-mono-numbers tracking-wide">ONLINE</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-text-secondary-dark font-mono-numbers">ID: 8849-2210</span>
                            <span className="text-[10px] text-text-secondary-dark font-mono-numbers flex items-center gap-1 opacity-60">
                                <span className="w-0.5 h-0.5 rounded-full bg-text-secondary-dark"></span>
                                192.168.1.42
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 md:px-8">
                     <div className="flex justify-between items-end mb-1">
                        <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold">Processing Task</div>
                        <div className="text-[10px] text-primary font-mono-numbers">84%</div>
                     </div>
                     <div className="w-full bg-background-dark h-1 rounded-full overflow-hidden border border-white/5">
                        <div className="bg-primary h-full rounded-full w-[84%]"></div>
                     </div>
                     <div className="mt-1 flex justify-between">
                        <div className="text-[10px] text-text-secondary-dark truncate">Compiling Asset Bundle v2.4</div>
                        <div className="text-[10px] text-text-secondary-dark font-mono-numbers">2m 14s</div>
                     </div>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-6 md:pl-4 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                    <div className="text-right">
                        <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Uptime</div>
                        <div className="text-xs text-text-primary-dark font-mono-numbers">14D 02H</div>
                    </div>
                    <div className="text-right border-l border-white/5 pl-4">
                        <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Load</div>
                        <div className="text-xs text-text-primary-dark font-mono-numbers">0.42</div>
                    </div>
                    <button className="ml-2 w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 rounded transition-colors">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Node 2 */}
            <div className="bg-surface-dark border border-border-dark rounded p-3 flex flex-col md:flex-row md:items-center justify-between hover:border-primary/50 transition-all group relative overflow-hidden gap-4 md:gap-0">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning/80"></div>
                <div className="flex items-center gap-4 pl-2">
                    <div className="w-9 h-9 rounded bg-background-dark border border-border-dark flex items-center justify-center relative">
                        <Network className="h-4 w-4 text-text-secondary-dark" />
                        <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-warning border border-background-dark animate-pulse"></span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-text-primary-dark tracking-wide">DB_SHARD_04</h3>
                            <span className="text-[9px] px-1.5 py-px rounded-full bg-warning/10 text-warning border border-warning/20 font-mono-numbers tracking-wide">BUSY</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-text-secondary-dark font-mono-numbers">ID: 4102-9983</span>
                            <span className="text-[10px] text-text-secondary-dark font-mono-numbers flex items-center gap-1 opacity-60">
                                <span className="w-0.5 h-0.5 rounded-full bg-text-secondary-dark"></span>
                                10.0.0.15
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 md:px-8">
                     <div className="flex justify-between items-end mb-1">
                        <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold">System Load</div>
                        <div className="text-[10px] text-warning font-mono-numbers">98%</div>
                     </div>
                     <div className="w-full bg-background-dark h-1 rounded-full overflow-hidden border border-white/5">
                        <div className="bg-warning h-full rounded-full w-[98%]"></div>
                     </div>
                     <div className="mt-1 flex justify-between">
                        <div className="text-[10px] text-text-secondary-dark truncate">Database Indexing (High I/O)</div>
                        <div className="text-[10px] text-text-secondary-dark font-mono-numbers">45m 10s</div>
                     </div>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-6 md:pl-4 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                    <div className="text-right">
                        <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Uptime</div>
                        <div className="text-xs text-text-primary-dark font-mono-numbers">42D 11H</div>
                    </div>
                    <div className="text-right border-l border-white/5 pl-4">
                        <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Load</div>
                        <div className="text-xs text-warning font-mono-numbers">3.82</div>
                    </div>
                    <button className="ml-2 w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 rounded transition-colors">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Node 3 */}
            <div className="bg-surface-dark border border-border-dark rounded p-3 flex flex-col md:flex-row md:items-center justify-between hover:border-primary/50 transition-all group relative overflow-hidden gap-4 md:gap-0">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-success/80"></div>
                <div className="flex items-center gap-4 pl-2">
                    <div className="w-9 h-9 rounded bg-background-dark border border-border-dark flex items-center justify-center relative">
                        <Terminal className="h-4 w-4 text-text-secondary-dark" />
                        <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-success border border-background-dark"></span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-text-primary-dark tracking-wide">WORKER_NODE_09</h3>
                            <span className="text-[9px] px-1.5 py-px rounded-full bg-success/10 text-success border border-success/20 font-mono-numbers tracking-wide">ONLINE</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-text-secondary-dark font-mono-numbers">ID: 7721-3341</span>
                            <span className="text-[10px] text-text-secondary-dark font-mono-numbers flex items-center gap-1 opacity-60">
                                <span className="w-0.5 h-0.5 rounded-full bg-text-secondary-dark"></span>
                                192.168.1.50
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 md:px-8">
                     <div className="flex justify-between items-end mb-1">
                        <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold">Status</div>
                        <div className="text-[10px] text-text-secondary-dark font-mono-numbers">IDLE</div>
                     </div>
                     <div className="w-full bg-background-dark h-1 rounded-full overflow-hidden border border-white/5">
                        <div className="bg-success/30 h-full rounded-full w-[2%]"></div>
                     </div>
                     <div className="mt-1 flex justify-between">
                        <div className="text-[10px] text-text-secondary-dark truncate">Awaiting instructions...</div>
                        <div className="text-[10px] text-text-secondary-dark font-mono-numbers">--</div>
                     </div>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-6 md:pl-4 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                    <div className="text-right">
                        <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Uptime</div>
                        <div className="text-xs text-text-primary-dark font-mono-numbers">03D 06H</div>
                    </div>
                    <div className="text-right border-l border-white/5 pl-4">
                        <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Load</div>
                        <div className="text-xs text-text-primary-dark font-mono-numbers">0.05</div>
                    </div>
                    <button className="ml-2 w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 rounded transition-colors">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Node 4 - Offline */}
            <div className="bg-surface-dark border border-border-dark rounded p-3 flex flex-col md:flex-row md:items-center justify-between hover:border-primary/50 transition-all group relative overflow-hidden gap-4 md:gap-0 opacity-70 hover:opacity-100">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-inactive-dark"></div>
                <div className="flex items-center gap-4 pl-2">
                    <div className="w-9 h-9 rounded bg-background-dark border border-border-dark flex items-center justify-center relative grayscale">
                        <Laptop className="h-4 w-4 text-text-secondary-dark" />
                        <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-inactive-dark border border-background-dark"></span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-text-secondary-dark tracking-wide">DEV_UNIT_03</h3>
                            <span className="text-[9px] px-1.5 py-px rounded-full bg-white/5 text-text-secondary-dark border border-border-dark font-mono-numbers tracking-wide">OFFLINE</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-text-secondary-dark font-mono-numbers">ID: 0021-5511</span>
                            <span className="text-[10px] text-text-secondary-dark font-mono-numbers flex items-center gap-1 opacity-60">
                                <span className="w-0.5 h-0.5 rounded-full bg-text-secondary-dark"></span>
                                10.0.0.88
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 md:px-8 opacity-50 grayscale">
                     <div className="flex justify-between items-end mb-1">
                        <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold">Last Seen</div>
                        <div className="text-[10px] text-text-secondary-dark font-mono-numbers">12H AGO</div>
                     </div>
                     <div className="w-full bg-background-dark h-1 rounded-full overflow-hidden border border-white/5">
                        <div className="bg-text-secondary-dark h-full rounded-full w-[0%]"></div>
                     </div>
                     <div className="mt-1 flex justify-between">
                        <div className="text-[10px] text-text-secondary-dark truncate">Connection lost</div>
                        <div className="text-[10px] text-text-secondary-dark font-mono-numbers">--</div>
                     </div>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-6 md:pl-4 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                    <div className="text-right opacity-50">
                        <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Uptime</div>
                        <div className="text-xs text-text-secondary-dark font-mono-numbers">--</div>
                    </div>
                    <div className="text-right border-l border-white/5 pl-4 opacity-50">
                        <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Load</div>
                        <div className="text-xs text-text-secondary-dark font-mono-numbers">0.00</div>
                    </div>
                    <button className="ml-2 w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 rounded transition-colors">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>
       </div>

       <div className="flex justify-between items-center pt-6 pb-2 text-[10px] text-text-secondary-dark border-t border-border-dark mt-8 uppercase tracking-widest opacity-60">
        <p>© 2025 SAAS MGR</p>
        <p className="font-mono-numbers">V.1.0.0-BETA</p>
      </div>
    </div>
  )
}

