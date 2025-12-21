import React from 'react'
import { Filter, LayoutGrid, CreditCard, Users as UsersIcon, Gauge, CheckCircle2, Code2, Key, ArrowUp, Settings, MoreVertical, ArrowRight, Minus, Plus, Database } from 'lucide-react'

export function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-border-dark pb-3">
        <div>
          <h2 className="text-sm font-bold text-text-secondary-dark uppercase tracking-widest mb-1">Inventory Executive Brief</h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-text-primary-dark font-medium"><span className="text-primary font-mono-numbers">2</span> Products Deployed</span>
            <span className="w-1 h-1 rounded-full bg-border-dark"></span>
            <span className="text-text-secondary-dark font-mono-numbers">v.2.4.0 Stable</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
            {[{ Icon: Filter, key: 'filter' }, { Icon: LayoutGrid, key: 'grid' }].map(({ Icon, key }) => (
                <button key={key} className="p-1.5 rounded bg-surface-dark border border-border-dark text-text-secondary-dark hover:text-primary hover:border-primary transition-all">
                    <Icon className="h-5 w-5" />
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
            { label: 'Total Revenue', value: '$124,500', Icon: CreditCard, valColor: 'text-text-primary-dark', iconColor: 'text-primary' },
            { label: 'Active Users', value: '8,242', Icon: UsersIcon, valColor: 'text-text-primary-dark', iconColor: 'text-primary' },
            { label: 'Avg. Response', value: '42ms', Icon: Gauge, valColor: 'text-text-primary-dark', iconColor: 'text-primary' },
            { label: 'Uptime', value: '99.9%', Icon: CheckCircle2, valColor: 'text-success', iconColor: 'text-success' },
        ].map((item, i) => (
             <div key={i} className="bg-surface-dark/50 border border-border-dark rounded p-3 flex items-center justify-between group hover:border-border-light/30 transition-colors">
                <div className="flex flex-col">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold">{item.label}</span>
                    <span className={`text-lg font-mono-numbers font-bold ${item.valColor}`}>{item.value}</span>
                </div>
                <item.Icon className={`h-5 w-5 ${item.iconColor} opacity-20 group-hover:opacity-40 transition-opacity`} />
            </div>
        ))}
      </div>

      <div className="space-y-3">
        {/* Product Card 1 */}
        <div className="group bg-surface-dark border border-border-dark rounded-lg p-0 overflow-hidden hover:border-primary/50 transition-all duration-300 relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary group-hover:bg-primary-hover transition-colors"></div>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded bg-background-dark border border-border-dark flex items-center justify-center shrink-0">
                        <Code2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-bold text-text-primary-dark">SaaS Analytics Pro</h3>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono-numbers border border-primary/20">VER 2.1</span>
                        </div>
                         <div className="flex items-center gap-3 text-xs text-text-secondary-dark">
                            <span className="flex items-center gap-1"><Key className="h-3.5 w-3.5" /> <span className="font-mono-numbers">ID: P-8821</span></span>
                            <span className="w-1 h-1 rounded-full bg-border-dark"></span>
                            <span>Updated <span className="font-mono-numbers">2h ago</span></span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6 sm:gap-10 border-t sm:border-t-0 border-border-dark pt-3 sm:pt-0 mt-3 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex flex-col items-start sm:items-end">
                        <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold mb-0.5">Status</span>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                            <span className="text-xs font-medium text-success tracking-wide">OPERATIONAL</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-start sm:items-end w-24">
                        <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold mb-0.5">Active Users</span>
                         <div className="flex items-center gap-2">
                            <span className="text-sm font-mono-numbers font-bold text-text-primary-dark">1,240</span>
                            <span className="text-[10px] text-success font-mono-numbers flex items-center">
                                <ArrowUp className="h-2.5 w-2.5" /> 12%
                            </span>
                        </div>
                    </div>
                     <div className="hidden sm:flex flex-col items-end w-24">
                        <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold mb-0.5">License Keys</span>
                        <span className="text-sm font-mono-numbers font-medium text-text-secondary-dark">450 / 500</span>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-border-dark h-8">
                     <button className="p-1.5 text-text-secondary-dark hover:text-text-primary-dark transition-colors">
                        <Settings className="h-5 w-5" />
                    </button>
                     <button className="p-1.5 text-text-secondary-dark hover:text-text-primary-dark transition-colors">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <div className="px-4 py-2 bg-background-dark border-t border-border-dark flex items-center justify-between text-[10px] text-text-secondary-dark font-mono-numbers">
                <div className="flex gap-4">
                    <span>REGION: <span className="text-text-primary-dark">US-EAST-1</span></span>
                    <span>INSTANCES: <span className="text-text-primary-dark">4</span></span>
                </div>
                <button className="text-primary hover:text-white uppercase tracking-wider font-bold flex items-center gap-1">
                    View Analytics <ArrowRight className="h-3 w-3 inline" />
                </button>
            </div>
        </div>

        {/* Product Card 2 */}
         <div className="group bg-surface-dark border border-border-dark rounded-lg p-0 overflow-hidden hover:border-primary/50 transition-all duration-300 relative opacity-90">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning group-hover:bg-warning transition-colors"></div>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded bg-background-dark border border-border-dark flex items-center justify-center shrink-0">
                        <Database className="h-5 w-5 text-warning" />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-bold text-text-primary-dark">Legacy DB Manager</h3>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-mono-numbers border border-warning/20">MAINTENANCE</span>
                        </div>
                         <div className="flex items-center gap-3 text-xs text-text-secondary-dark">
                            <span className="flex items-center gap-1"><Key className="h-3.5 w-3.5" /> <span className="font-mono-numbers">ID: D-1092</span></span>
                            <span className="w-1 h-1 rounded-full bg-border-dark"></span>
                            <span>Updated <span className="font-mono-numbers">4d ago</span></span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6 sm:gap-10 border-t sm:border-t-0 border-border-dark pt-3 sm:pt-0 mt-3 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex flex-col items-start sm:items-end">
                        <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold mb-0.5">Status</span>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                            <span className="text-xs font-medium text-warning tracking-wide">LIMITED</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-start sm:items-end w-24">
                        <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold mb-0.5">Active Users</span>
                         <div className="flex items-center gap-2">
                            <span className="text-sm font-mono-numbers font-bold text-text-primary-dark">85</span>
                            <span className="text-[10px] text-inactive-dark font-mono-numbers flex items-center">
                                <Minus className="h-2.5 w-2.5" /> 0%
                            </span>
                        </div>
                    </div>
                     <div className="hidden sm:flex flex-col items-end w-24">
                        <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-semibold mb-0.5">License Keys</span>
                        <span className="text-sm font-mono-numbers font-medium text-text-secondary-dark">12 / 50</span>
                    </div>
                </div>
                 <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-border-dark h-8">
                     <button className="p-1.5 text-text-secondary-dark hover:text-text-primary-dark transition-colors">
                        <Settings className="h-5 w-5" />
                    </button>
                     <button className="p-1.5 text-text-secondary-dark hover:text-text-primary-dark transition-colors">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <div className="px-4 py-2 bg-background-dark border-t border-border-dark flex items-center justify-between text-[10px] text-text-secondary-dark font-mono-numbers">
                <div className="flex gap-4">
                    <span>REGION: <span className="text-text-primary-dark">EU-WEST-2</span></span>
                    <span>INSTANCES: <span className="text-text-primary-dark">1</span></span>
                </div>
                <button className="text-text-secondary-dark hover:text-white uppercase tracking-wider font-bold flex items-center gap-1">
                    View Analytics <ArrowRight className="h-3 w-3 inline" />
                </button>
            </div>
        </div>

        <button className="w-full border border-dashed border-border-dark rounded-lg p-6 flex flex-col items-center justify-center text-text-secondary-dark hover:text-primary hover:border-primary/50 hover:bg-surface-dark transition-all duration-300 group">
            <div className="w-10 h-10 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Plus className="h-8 w-8 group-hover:text-primary transition-colors" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Deploy New Product</span>
        </button>
      </div>
      
       <div className="flex justify-between items-center pt-6 pb-2 text-[10px] text-text-secondary-dark border-t border-border-dark mt-8 uppercase tracking-widest opacity-60">
        <p>© 2025 SAAS MGR</p>
        <p className="font-mono-numbers">V.1.0.0-BETA</p>
      </div>
    </div>
  )
}

