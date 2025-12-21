import React from 'react'
import { History, Plus, CheckCircle2, Send, AlertCircle, ShoppingCart, Users, Bell, Play, Settings, Trash2, Eye, Copy, RefreshCw } from 'lucide-react'
import { Card } from '@/shared/ui/components/card'
import { Separator } from '@/shared/ui/components/separator'

export function WebhooksPage() {
  return (
    <div className="space-y-5">
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[
            { label: 'Success Rate', val: '99.8%', sub: 'LAST 24H', Icon: CheckCircle2, iconColor: 'text-success' },
            { label: 'Events Sent', val: '14.2k', sub: 'TOTAL', Icon: Send, iconColor: 'text-primary' },
            { label: 'Failures', val: '3', sub: 'REQUIRE ATTENTION', Icon: AlertCircle, iconColor: 'text-error' },
        ].map((item, i) => (
            <Card key={i} className="bg-surface-dark border-border-dark rounded p-4 flex flex-col justify-between h-24 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
                 <div className="flex justify-between items-start z-10">
                    <div className="flex items-center gap-2 text-text-secondary-dark text-xs font-semibold uppercase tracking-wider">
                        <item.Icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
                        {item.label}
                    </div>
                </div>
                <div className="z-10 flex items-end justify-between">
                    <div className="text-2xl font-bold text-text-primary-dark font-mono-numbers tracking-tight">{item.val}</div>
                    <div className="text-[10px] text-text-secondary-dark mb-1 font-mono-numbers text-right">{item.sub}</div>
                </div>
                {i === 0 && (
                     <div className="absolute right-0 bottom-0 h-8 w-24 opacity-20">
                        <div className="flex items-end h-full w-full gap-1 px-2 pb-2">
                            <div className="w-1 bg-success h-3/4 rounded-t-sm"></div>
                            <div className="w-1 bg-success h-full rounded-t-sm"></div>
                            <div className="w-1 bg-success h-2/3 rounded-t-sm"></div>
                            <div className="w-1 bg-success h-5/6 rounded-t-sm"></div>
                            <div className="w-1 bg-success h-full rounded-t-sm"></div>
                        </div>
                    </div>
                )}
            </Card>
        ))}
       </div>

       <div className="space-y-3">
         {/* Item 1 */}
          <Card className="bg-surface-dark border-border-dark rounded p-4 flex flex-col md:flex-row md:items-center justify-between hover:border-primary/50 transition-all group relative overflow-hidden gap-4 md:gap-0 shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-success/80"></div>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 pl-2 flex-1">
                <div className="w-10 h-10 rounded bg-background-dark border border-border-dark flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="h-5 w-5 text-text-secondary-dark" />
                </div>
                <div className="min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-text-primary-dark tracking-wide">Order Fulfillment</h3>
                        <span className="text-[9px] px-1.5 py-px rounded-full bg-success/10 text-success border border-success/20 font-mono-numbers tracking-wide uppercase">Active</span>
                    </div>
                    <div className="text-[10px] text-text-secondary-dark font-mono-numbers flex items-center gap-2">
                        <span className="bg-white/5 px-1 rounded text-text-secondary-dark">POST</span>
                        <span className="truncate max-w-[200px] opacity-70">https://api.logistics.inc/v1/orders/create</span>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest bg-background-dark border border-border-dark px-2 py-0.5 rounded">order.created</span>
                    <span className="text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest bg-background-dark border border-border-dark px-2 py-0.5 rounded">order.paid</span>
                </div>
            </div>
            <div className="flex items-center gap-6 md:pl-8 md:border-l border-white/5">
                <div className="text-right hidden sm:block">
                    <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Last Delivery</div>
                    <div className="text-xs text-text-primary-dark font-mono-numbers flex items-center gap-1 justify-end">
                        <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                        2m ago
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {[{ icon: Play, key: 'play' }, { icon: Settings, key: 'settings' }, { icon: Trash2, key: 'delete' }].map(({ icon: Icon, key }) => (
                         <button key={key} className={`w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:bg-white/5 rounded transition-colors ${key === 'delete' ? 'hover:text-error' : 'hover:text-text-primary-dark'}`}>
                            <Icon className="h-4 w-4" />
                        </button>
                    ))}
                </div>
            </div>
          </Card>

           {/* Item 2 */}
          <Card className="bg-surface-dark border-border-dark rounded p-4 flex flex-col md:flex-row md:items-center justify-between hover:border-primary/50 transition-all group relative overflow-hidden gap-4 md:gap-0 shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/80"></div>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 pl-2 flex-1">
                <div className="w-10 h-10 rounded bg-background-dark border border-border-dark flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-text-secondary-dark" />
                </div>
                <div className="min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-text-primary-dark tracking-wide">CRM Sync</h3>
                        <span className="text-[9px] px-1.5 py-px rounded-full bg-primary/10 text-primary border border-primary/20 font-mono-numbers tracking-wide uppercase">Active</span>
                    </div>
                    <div className="text-[10px] text-text-secondary-dark font-mono-numbers flex items-center gap-2">
                        <span className="bg-white/5 px-1 rounded text-text-secondary-dark">POST</span>
                        <span className="truncate max-w-[200px] opacity-70">https://crm-hook.salesforce.com/ingest</span>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest bg-background-dark border border-border-dark px-2 py-0.5 rounded">user.signup</span>
                </div>
            </div>
            <div className="flex items-center gap-6 md:pl-8 md:border-l border-white/5">
                <div className="text-right hidden sm:block">
                    <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Last Delivery</div>
                    <div className="text-xs text-text-primary-dark font-mono-numbers flex items-center gap-1 justify-end">
                        <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                        14h ago
                    </div>
                </div>
                 <div className="flex items-center gap-1">
                    {[{ icon: Play, key: 'play' }, { icon: Settings, key: 'settings' }, { icon: Trash2, key: 'delete' }].map(({ icon: Icon, key }) => (
                         <button key={key} className={`w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:bg-white/5 rounded transition-colors ${key === 'delete' ? 'hover:text-error' : 'hover:text-text-primary-dark'}`}>
                            <Icon className="h-4 w-4" />
                        </button>
                    ))}
                </div>
            </div>
          </Card>

           {/* Item 3 */}
          <Card className="bg-surface-dark border-border-dark rounded p-4 flex flex-col md:flex-row md:items-center justify-between hover:border-primary/50 transition-all group relative overflow-hidden gap-4 md:gap-0 shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-error/80"></div>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 pl-2 flex-1">
                <div className="w-10 h-10 rounded bg-background-dark border border-border-dark flex items-center justify-center flex-shrink-0">
                    <Bell className="h-5 w-5 text-text-secondary-dark" />
                </div>
                <div className="min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-text-primary-dark tracking-wide">Slack Alerts</h3>
                        <span className="text-[9px] px-1.5 py-px rounded-full bg-error/10 text-error border border-error/20 font-mono-numbers tracking-wide uppercase">Failing</span>
                    </div>
                    <div className="text-[10px] text-text-secondary-dark font-mono-numbers flex items-center gap-2">
                        <span className="bg-white/5 px-1 rounded text-text-secondary-dark">POST</span>
                        <span className="truncate max-w-[200px] opacity-70">https://hooks.slack.com/services/T000...</span>
                    </div>
                </div>
                 <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest bg-background-dark border border-border-dark px-2 py-0.5 rounded">alert.critical</span>
                     <span className="text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest bg-background-dark border border-border-dark px-2 py-0.5 rounded">system.down</span>
                </div>
            </div>
            <div className="flex items-center gap-6 md:pl-8 md:border-l border-white/5">
                <div className="text-right hidden sm:block">
                    <div className="text-[9px] text-text-secondary-dark uppercase tracking-widest opacity-60">Last Delivery</div>
                    <div className="text-xs text-error font-mono-numbers flex items-center gap-1 justify-end">
                        <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                        Error 401
                    </div>
                </div>
                 <div className="flex items-center gap-1">
                    {[{ icon: Play, key: 'play' }, { icon: Settings, key: 'settings' }, { icon: Trash2, key: 'delete' }].map(({ icon: Icon, key }) => (
                         <button key={key} className={`w-7 h-7 flex items-center justify-center text-text-secondary-dark hover:bg-white/5 rounded transition-colors ${key === 'delete' ? 'hover:text-error' : 'hover:text-text-primary-dark'}`}>
                            <Icon className="h-4 w-4" />
                        </button>
                    ))}
                </div>
            </div>
          </Card>
       </div>
       
       <Card className="bg-surface-dark border-border-dark rounded p-5 mt-8 relative shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h3 className="text-sm font-semibold text-text-primary-dark mb-1">Signing Secret</h3>
                    <p className="text-xs text-text-secondary-dark max-w-lg">Use this secret to verify that the webhook events are coming from our platform. Do not share this key.</p>
                </div>
                 <div className="bg-surface-dark border border-border-dark rounded flex items-center pr-2 pl-3 py-1.5 w-full md:w-auto min-w-[320px]">
                    <span className="text-[10px] text-text-secondary-dark mr-3 font-mono-numbers">whsec_...</span>
                    <input className="bg-transparent border-none text-xs text-text-primary-dark font-mono-numbers focus:ring-0 w-full p-0 h-auto tracking-widest" type="password" defaultValue="whsec_839201938201938290183902183901" readOnly/>
                     <button className="ml-2 text-text-secondary-dark hover:text-primary transition-colors">
                        <Eye className="h-3.5 w-3.5" />
                    </button>
                     <button className="ml-2 text-text-secondary-dark hover:text-primary transition-colors">
                        <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button className="ml-2 text-text-secondary-dark hover:text-primary transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
       </Card>

       <div className="relative flex justify-between items-center pt-6 pb-2 text-[10px] text-text-secondary-dark mt-8 uppercase tracking-widest opacity-60">
            <Separator className="absolute top-0 left-0 right-0 border-border-dark" />
        <p>© 2025 SAAS MGR</p>
        <p className="font-mono-numbers">V.1.0.0-BETA</p>
      </div>
    </div>
  )
}

