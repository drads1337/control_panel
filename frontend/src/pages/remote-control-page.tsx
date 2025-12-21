import React from 'react'
import { Search, Terminal, Link2Off, CirclePlus, Gauge, Folder, RotateCcw, Power, Lock, Play, FileText, Network, Shield } from 'lucide-react'

export function RemoteControlPage() {
  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Sidebar List */}
        <div className="w-full lg:w-80 flex flex-col gap-4 flex-shrink-0 h-full">
             <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-text-secondary-dark" />
                </span>
                <input className="w-full bg-surface-dark border border-border-dark rounded pl-9 pr-3 py-2 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark transition-all" placeholder="Find target..." type="text"/>
            </div>

            <div className="bg-surface-dark border border-border-dark rounded flex-1 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-border-dark flex justify-between items-center bg-white/5">
                    <span className="text-[10px] uppercase font-bold text-text-secondary-dark tracking-widest">Available Nodes</span>
                    <span className="text-[10px] font-mono-numbers text-primary bg-white/5 px-1.5 rounded border border-white/10">4 ONLINE</span>
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {/* Active Item */}
                     <div className="p-3 rounded border border-primary/30 bg-white/5 cursor-pointer group relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"></div>
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                <span className="text-xs font-semibold text-text-primary-dark">NODE_ALPHA_01</span>
                            </div>
                            <Terminal className="h-3 w-3 text-primary" />
                        </div>
                         <div className="flex justify-between items-center text-[10px] text-text-secondary-dark font-mono-numbers">
                            <span>192.168.1.42</span>
                            <span className="opacity-60">SSH:22</span>
                        </div>
                    </div>
                     {/* Other items */}
                     {[
                         { name: 'DB_SHARD_04', ip: '10.0.0.15', type: 'SQL', status: 'bg-amber-500' },
                         { name: 'WORKER_NODE_09', ip: '192.168.1.50', type: 'SSH:22', status: 'bg-emerald-500' },
                         { name: 'DEV_UNIT_03', ip: '10.0.0.88', type: 'RDP', status: 'bg-inactive-dark', offline: true }
                     ].map((node, i) => (
                        <div key={i} className={`p-3 rounded border border-transparent hover:border-border-dark hover:bg-white/5 cursor-pointer transition-colors group ${node.offline ? 'opacity-60' : ''}`}>
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full ${node.status}`}></span>
                                    <span className="text-xs font-medium text-text-secondary-dark group-hover:text-text-primary-dark">{node.name}</span>
                                </div>
                                {node.offline ? <Link2Off className="h-3 w-3 text-text-secondary-dark opacity-0 group-hover:opacity-100" /> : <Terminal className="h-3 w-3 text-text-secondary-dark opacity-0 group-hover:opacity-100" />}
                            </div>
                             <div className="flex justify-between items-center text-[10px] text-text-secondary-dark font-mono-numbers opacity-70">
                                <span>{node.ip}</span>
                                <span>{node.type}</span>
                            </div>
                        </div>
                     ))}
                </div>
                 <div className="p-2 border-t border-border-dark bg-white/5">
                    <button className="w-full py-1.5 rounded border border-border-dark text-[10px] font-medium text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 transition-colors uppercase tracking-wider flex items-center justify-center gap-2">
                        <CirclePlus className="h-3.5 w-3.5" />
                        Add Connection
                    </button>
                </div>
            </div>
        </div>

        {/* Terminal Area */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 h-full pb-6 lg:pb-0">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-dark border border-border-dark rounded shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-mono font-medium text-text-primary-dark">NODE_ALPHA_01</span>
                    </div>
                    <div className="hidden sm:block h-4 w-px bg-border-dark"></div>
                    <div className="flex items-center gap-2">
                        <Gauge className="h-3.5 w-3.5 text-text-secondary-dark" />
                        <span className="text-[10px] font-mono text-text-secondary-dark">24ms</span>
                    </div>
                     <div className="hidden sm:block h-4 w-px bg-border-dark"></div>
                     <span className="text-[10px] font-mono text-text-secondary-dark hidden sm:inline">UPTIME: 14D 02H 12M</span>
                </div>
                 <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button className="p-1.5 text-text-secondary-dark hover:text-primary hover:bg-surface-dark border border-transparent hover:border-border-dark rounded transition-colors" title="Transfer Files">
                        <Folder className="h-5 w-5" />
                    </button>
                    <button className="p-1.5 text-text-secondary-dark hover:text-primary hover:bg-surface-dark border border-transparent hover:border-border-dark rounded transition-colors" title="Restart Session">
                        <RotateCcw className="h-5 w-5" />
                    </button>
                    <button className="p-1.5 text-text-secondary-dark hover:text-red-400 hover:bg-surface-dark border border-transparent hover:border-border-dark rounded transition-colors" title="Terminate">
                        <Power className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-[#090a0d] border border-border-dark rounded-lg p-0 flex flex-col font-mono text-sm relative overflow-hidden shadow-2xl group">
                 <div className="bg-[#131519] border-b border-border-dark px-4 py-2 flex items-center justify-between select-none z-10">
                    <div className="flex items-center gap-2">
                        <Lock className="h-3 w-3 text-text-secondary-dark" />
                        <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider">Secure Shell (SSH-2)</span>
                    </div>
                    <div className="flex gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="w-2.5 h-2.5 rounded-full bg-border-dark hover:bg-yellow-500/50 cursor-pointer transition-colors"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-border-dark hover:bg-green-500/50 cursor-pointer transition-colors"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-border-dark hover:bg-red-500/50 cursor-pointer transition-colors"></div>
                    </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto font-mono text-xs md:text-sm leading-relaxed text-gray-300 scroll-smooth">
                    <div className="mb-2 opacity-50">Last login: Tue Oct 24 14:03:12 on ttys002</div>
                    <div className="mb-4">
                        <span className="text-emerald-500">sysadmin@node-alpha-01</span>:<span className="text-blue-400">~</span>$ status check --full<br/>
                        <span className="text-gray-400">
                            [INFO] Checking system integrity...<br/>
                            [INFO] CPU Load: 12% (Nominal)<br/>
                            [INFO] Memory: 4.2GB / 16GB Used<br/>
                            [OK]   Filesystem mounted (RW)<br/>
                            [OK]   Network interfaces up<br/>
                        </span>
                    </div>
                    <div className="mb-4">
                        <span className="text-emerald-500">sysadmin@node-alpha-01</span>:<span className="text-blue-400">~</span>$ tail -f /var/log/syslog<br/>
                        <span className="text-gray-500">Oct 24 14:05:01 node-alpha-01 CRON[12991]: (root) CMD (command -v debian-sa1 &gt; /dev/null &amp;&amp; debian-sa1 1 1)</span><br/>
                        <span className="text-gray-500">Oct 24 14:05:22 node-alpha-01 kernel: [92811.21] [UFW BLOCK] IN=eth0 OUT= MAC=00:... SRC=192.168.1.100</span><br/>
                        <span className="text-gray-500">Oct 24 14:06:15 node-alpha-01 systemd[1]: Starting Daily apt upgrade and clean activities...</span>
                    </div>
                    <div>
                        <span className="text-emerald-500">sysadmin@node-alpha-01</span>:<span className="text-blue-400">~</span>$ <span className="animate-pulse bg-gray-300 w-2 h-4 inline-block align-middle ml-1"></span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-shrink-0">
                 <button className="bg-surface-dark border border-border-dark hover:border-primary/50 p-2 rounded text-left group transition-all">
                    <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider mb-0.5">Quick Macro</div>
                    <div className="text-xs text-text-primary-dark font-mono flex items-center gap-2">
                        <Play className="h-3.5 w-3.5 text-emerald-500" />
                        Restart Svc
                    </div>
                </button>
                 <button className="bg-surface-dark border border-border-dark hover:border-primary/50 p-2 rounded text-left group transition-all">
                    <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider mb-0.5">Quick Macro</div>
                    <div className="text-xs text-text-primary-dark font-mono flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-blue-500" />
                        Fetch Logs
                    </div>
                </button>
                 <button className="bg-surface-dark border border-border-dark hover:border-primary/50 p-2 rounded text-left group transition-all">
                    <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider mb-0.5">Diagnostic</div>
                    <div className="text-xs text-text-primary-dark font-mono flex items-center gap-2">
                        <Network className="h-3.5 w-3.5 text-amber-500" />
                        Ping Check
                    </div>
                </button>
                 <button className="bg-surface-dark border border-border-dark hover:border-red-500/50 p-2 rounded text-left group transition-all">
                    <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider mb-0.5">System</div>
                    <div className="text-xs text-text-primary-dark group-hover:text-red-400 font-mono flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-red-500" />
                        Lockdown
                    </div>
                </button>
            </div>
        </div>
    </div>
  )
}

