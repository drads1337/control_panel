import React from 'react'
import { ShieldCheck, Shield, Lock, FileText, AlertTriangle, Download, Printer, Settings, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/components/card'
import { Separator } from '@/shared/ui/components/separator'

export function SecurityPage() {
  return (
    <div className="space-y-5">
       <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {/* Score Card */}
        <Card className="md:col-span-1 bg-surface-dark border-border-dark rounded p-4 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
            <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Security Score</span>
                    <ShieldCheck className="h-4 w-4 text-success" />
                </div>
                <div>
                    <div className="text-4xl font-bold text-text-primary-dark font-mono-numbers tracking-tighter">98<span className="text-lg text-text-secondary-dark">/100</span></div>
                    <div className="text-[10px] text-success mt-1 font-mono-numbers">+2.4% vs last week</div>
                </div>
                <div className="w-full bg-background-dark h-1 rounded-full overflow-hidden border border-white/5 mt-2">
                    <div className="bg-success h-full rounded-full w-[98%] shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                </div>
            </div>
        </Card>

         <Card className="md:col-span-1 bg-surface-dark border-border-dark rounded p-4 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
            <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Active Threats</span>
                    <Shield className="h-4 w-4 text-text-secondary-dark" />
                </div>
                <div>
                    <div className="text-4xl font-bold text-text-primary-dark font-mono-numbers tracking-tighter">0</div>
                    <div className="text-[10px] text-text-secondary-dark mt-1 font-mono-numbers">ALL SYSTEMS CLEAR</div>
                </div>
            </div>
        </Card>

        <Card className="md:col-span-1 bg-surface-dark border-border-dark rounded p-4 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
             <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Failed Auth</span>
                    <Lock className="h-4 w-4 text-warning" />
                </div>
                <div>
                    <div className="text-4xl font-bold text-text-primary-dark font-mono-numbers tracking-tighter">12</div>
                    <div className="text-[10px] text-warning mt-1 font-mono-numbers">LAST 24 HOURS</div>
                </div>
            </div>
        </Card>

        <Card className="md:col-span-1 bg-surface-dark border-border-dark rounded p-4 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
             <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Compliance</span>
                    <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <div className="text-xl font-bold text-text-primary-dark tracking-tight">SOC2 Type II</div>
                    <div className="text-[10px] text-text-secondary-dark mt-1 font-mono-numbers uppercase">Audit: Passed</div>
                </div>
                <div className="flex gap-1 mt-2">
                    <span className="h-1.5 w-1.5 bg-primary rounded-full"></span>
                    <span className="h-1.5 w-1.5 bg-primary rounded-full"></span>
                    <span className="h-1.5 w-1.5 bg-primary rounded-full"></span>
                    <span className="h-1.5 w-1.5 bg-border-dark rounded-full"></span>
                </div>
            </div>
        </Card>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-primary-dark uppercase tracking-wider">Recent Audit Events</h3>
                    <button className="text-[10px] text-primary hover:underline font-mono-numbers">VIEW ALL LOGS →</button>
                </div>
                <Card className="bg-surface-dark border-border-dark rounded overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                         <thead>
                            <tr className="border-b border-border-dark bg-white/5">
                                <th className="py-2 px-4 font-medium text-text-secondary-dark uppercase tracking-wider w-24">Time</th>
                                <th className="py-2 px-4 font-medium text-text-secondary-dark uppercase tracking-wider">Event</th>
                                <th className="py-2 px-4 font-medium text-text-secondary-dark uppercase tracking-wider">User</th>
                                <th className="py-2 px-4 font-medium text-text-secondary-dark uppercase tracking-wider text-right">IP Address</th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-border-dark/50 font-mono-numbers">
                             {[
                                 { time: '10:42:05', event: 'Configuration change: Firewall rules updated', user: 'admin@sys', ip: '192.168.1.42' },
                                 { time: '10:15:22', event: 'User login successful', user: 'j.doe', ip: '10.0.0.15' },
                                 { time: '09:55:01', event: 'Failed login attempt (3x)', user: 'unknown', ip: '203.0.113.8', warning: true },
                                 { time: '09:30:00', event: 'API Key generated: "Production-Read"', user: 'admin@sys', ip: '192.168.1.42' },
                                 { time: '08:12:44', event: 'System backup completed', user: 'system', ip: 'localhost' },
                             ].map((log, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="py-3 px-4 text-text-secondary-dark">{log.time}</td>
                                    <td className={`py-3 px-4 ${log.warning ? 'text-warning font-sans flex items-center gap-2' : 'text-text-primary-dark font-sans group-hover:text-primary transition-colors'}`}>
                                        {log.warning && <AlertTriangle className="h-3 w-3 inline" />}
                                        {log.event}
                                    </td>
                                    <td className="py-3 px-4 text-text-secondary-dark">{log.user}</td>
                                    <td className="py-3 px-4 text-text-secondary-dark text-right opacity-70">{log.ip}</td>
                                </tr>
                             ))}
                         </tbody>
                    </table>
                </Card>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[{ Icon: Download, label: 'Export CSV' }, { Icon: Printer, label: 'Print Report' }, { Icon: Settings, label: 'Log Settings' }, { Icon: Trash2, label: 'Purge Old' }].map(({ Icon, label }, i) => (
                        <button key={i} className="flex items-center justify-center gap-2 px-4 py-2 bg-surface-dark border border-border-dark hover:border-primary/50 text-text-secondary-dark hover:text-text-primary-dark rounded transition-all text-xs font-medium uppercase tracking-wide group">
                            <Icon className="h-4 w-4 group-hover:text-primary" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-1 space-y-4">
                <h3 className="text-sm font-semibold text-text-primary-dark uppercase tracking-wider">Access Controls</h3>
                <Card className="bg-surface-dark border-border-dark rounded p-5 space-y-6 relative shadow-sm">
                    <div className="flex items-start justify-between group cursor-pointer">
                        <div className="space-y-1">
                            <div className="text-xs font-semibold text-text-primary-dark group-hover:text-primary transition-colors">Multi-Factor Auth (MFA)</div>
                            <div className="text-[10px] text-text-secondary-dark leading-tight">Enforce 2FA for all admin accounts.</div>
                        </div>
                        <div className="relative inline-flex h-4 w-8 items-center rounded-full bg-primary transition-colors">
                            <span className="translate-x-4 inline-block h-3 w-3 transform rounded-full bg-background-dark shadow transition duration-200 ease-in-out"></span>
                        </div>
                    </div>
                     <div className="flex items-start justify-between group cursor-pointer">
                        <div className="space-y-1">
                            <div className="text-xs font-semibold text-text-primary-dark group-hover:text-primary transition-colors">API Rate Limiting</div>
                            <div className="text-[10px] text-text-secondary-dark leading-tight">Restrict to 100 req/min per IP.</div>
                        </div>
                        <div className="relative inline-flex h-4 w-8 items-center rounded-full bg-primary transition-colors">
                            <span className="translate-x-4 inline-block h-3 w-3 transform rounded-full bg-background-dark shadow transition duration-200 ease-in-out"></span>
                        </div>
                    </div>
                     <div className="flex items-start justify-between group cursor-pointer">
                        <div className="space-y-1">
                            <div className="text-xs font-semibold text-text-primary-dark group-hover:text-primary transition-colors">Public Access</div>
                            <div className="text-[10px] text-text-secondary-dark leading-tight">Allow public read access to status page.</div>
                        </div>
                        <div className="relative inline-flex h-4 w-8 items-center rounded-full bg-border-dark transition-colors">
                            <span className="translate-x-1 inline-block h-3 w-3 transform rounded-full bg-text-secondary-dark shadow transition duration-200 ease-in-out"></span>
                        </div>
                    </div>

                    <hr className="border-border-dark"/>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-text-secondary-dark">
                            <span>Password Strength</span>
                            <span className="text-success">Strong</span>
                        </div>
                        <div className="flex gap-1 h-1 w-full">
                            <div className="flex-1 bg-success rounded-l-full"></div>
                            <div className="flex-1 bg-success"></div>
                            <div className="flex-1 bg-success"></div>
                            <div className="flex-1 bg-border-dark/50 rounded-r-full"></div>
                        </div>
                    </div>

                     <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-text-secondary-dark">
                            <span>Session Timeout</span>
                            <span>15m</span>
                        </div>
                        <input className="w-full h-1 bg-border-dark rounded-lg appearance-none cursor-pointer accent-primary" type="range" min="1" max="60" defaultValue="15"/>
                    </div>
                </Card>

                <Card className="bg-surface-dark border-error/30 rounded p-4 relative overflow-hidden shadow-sm">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-error"></div>
                    <div className="flex items-start gap-3 pl-2">
                        <AlertTriangle className="h-5 w-5 text-error" />
                        <div>
                            <h4 className="text-xs font-bold text-text-primary-dark uppercase tracking-wide">Critical Update</h4>
                            <p className="text-[10px] text-text-secondary-dark mt-1 leading-relaxed">
                                Security patch v2.4.1 is available. Addresses CVE-2024-9921 regarding unauthorized escalating privileges.
                            </p>
                            <button className="mt-2 text-[10px] bg-error/10 hover:bg-error/20 text-error px-2 py-1 rounded border border-error/20 transition-colors font-semibold uppercase tracking-wide">
                                Install Patch Now
                            </button>
                        </div>
                    </div>
                </Card>
            </div>
       </div>

       <div className="relative flex justify-between items-center pt-6 pb-2 text-[10px] text-text-secondary-dark mt-8 uppercase tracking-widest opacity-60">
            <Separator className="absolute top-0 left-0 right-0 border-border-dark" />
        <p>© 2025 SAAS MGR</p>
        <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                SYSTEM HEALTHY
            </span>
            <p className="font-mono-numbers">V.1.0.0-BETA</p>
        </div>
      </div>
    </div>
  )
}

