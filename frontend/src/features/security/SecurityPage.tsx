import React from 'react'
import { ShieldCheck, Shield, Lock, FileText, AlertTriangle, Download, Printer, Settings, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/components/card'
import { Button } from '@/shared/ui/components/button'
import { useSecurityData } from './hooks/use-security-data'
import { format } from 'date-fns'

function formatEventTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    return format(date, 'HH:mm:ss')
  } catch {
    return '--:--:--'
  }
}

function getSeverityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'text-error'
    case 'high':
      return 'text-warning'
    case 'medium':
      return 'text-primary'
    default:
      return 'text-text-secondary-dark'
  }
}

export function SecurityPage() {
  const {
    stats,
    events,
    analytics,
    loading,
    refreshing,
    error,
    handleRefresh,
    calculateSecurityScore,
    getFailedAuthCount,
    getActiveThreatsCount,
  } = useSecurityData()

  const securityScore = calculateSecurityScore()
  const activeThreats = getActiveThreatsCount()
  const failedAuth = getFailedAuthCount()
  const scoreColor = securityScore >= 90 ? 'text-success' : securityScore >= 70 ? 'text-warning' : 'text-error'
  const scoreBarColor = securityScore >= 90 ? 'bg-success' : securityScore >= 70 ? 'bg-warning' : 'bg-error'

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-text-secondary-dark" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <Card className="bg-error/10 border-error/20 rounded p-4">
          <div className="text-sm text-error">{error}</div>
        </Card>
      )}

       <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {/* Score Card */}
        <Card className="md:col-span-1 bg-surface-dark border-border-dark rounded p-4 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
            <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Security Score</span>
                    <ShieldCheck className={`h-4 w-4 ${scoreColor}`} />
                </div>
                <div>
                    <div className={`text-4xl font-bold font-mono-numbers tracking-tighter ${scoreColor}`}>
                      {securityScore}<span className="text-lg text-text-secondary-dark">/100</span>
                    </div>
                    <div className={`text-[10px] mt-1 font-mono-numbers ${stats?.activeBlocks ? 'text-warning' : 'text-success'}`}>
                      {stats?.activeBlocks ? `${stats.activeBlocks} active blocks` : 'All systems clear'}
                    </div>
                </div>
                <div className="w-full bg-background-dark h-1 rounded-full overflow-hidden border border-white/5 mt-2">
                    <div className={`${scoreBarColor} h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]`} style={{ width: `${securityScore}%` }}></div>
                </div>
            </div>
        </Card>

         <Card className="md:col-span-1 bg-surface-dark border-border-dark rounded p-4 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
            <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Active Threats</span>
                    <Shield className={`h-4 w-4 ${activeThreats > 0 ? 'text-warning' : 'text-text-secondary-dark'}`} />
                </div>
                <div>
                    <div className="text-4xl font-bold text-text-primary-dark font-mono-numbers tracking-tighter">{activeThreats}</div>
                    <div className={`text-[10px] mt-1 font-mono-numbers ${activeThreats > 0 ? 'text-warning' : 'text-text-secondary-dark'}`}>
                      {activeThreats > 0 ? 'REQUIRE ATTENTION' : 'ALL SYSTEMS CLEAR'}
                    </div>
                </div>
            </div>
        </Card>

        <Card className="md:col-span-1 bg-surface-dark border-border-dark rounded p-4 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
             <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Failed Auth</span>
                    <Lock className={`h-4 w-4 ${failedAuth > 0 ? 'text-warning' : 'text-text-secondary-dark'}`} />
                </div>
                <div>
                    <div className="text-4xl font-bold text-text-primary-dark font-mono-numbers tracking-tighter">{failedAuth}</div>
                    <div className={`text-[10px] mt-1 font-mono-numbers ${failedAuth > 0 ? 'text-warning' : 'text-text-secondary-dark'}`}>LAST 24 HOURS</div>
                </div>
            </div>
        </Card>

        <Card className="md:col-span-1 bg-surface-dark border-border-dark rounded p-4 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
             <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] text-text-secondary-dark uppercase tracking-widest font-semibold">Active Blocks</span>
                    <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <div className="text-4xl font-bold text-text-primary-dark font-mono-numbers tracking-tighter">{stats?.activeBlocks || 0}</div>
                    <div className="text-[10px] text-text-secondary-dark mt-1 font-mono-numbers">
                      {stats?.blockedIPs || 0} IPs, {stats?.blockedHWIDs || 0} HWIDs
                    </div>
                </div>
            </div>
        </Card>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-primary-dark uppercase tracking-wider">Recent Audit Events</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="text-text-secondary-dark hover:text-text-primary-dark"
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                      </Button>
                      <button className="text-[10px] text-primary hover:underline font-mono-numbers">VIEW ALL LOGS →</button>
                    </div>
                </div>
                <Card className="bg-surface-dark border-border-dark rounded overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                         <thead>
                            <tr className="border-b border-border-dark bg-white/5">
                                <th className="py-2 px-4 font-medium text-text-secondary-dark uppercase tracking-wider w-24">Time</th>
                                <th className="py-2 px-4 font-medium text-text-secondary-dark uppercase tracking-wider">Event</th>
                                <th className="py-2 px-4 font-medium text-text-secondary-dark uppercase tracking-wider">Severity</th>
                                <th className="py-2 px-4 font-medium text-text-secondary-dark uppercase tracking-wider text-right">IP Address</th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-border-dark/50 font-mono-numbers">
                             {loading && !events.length ? (
                                <tr>
                                    <td colSpan={4} className="py-8 px-4 text-center text-text-secondary-dark">
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                        Loading events...
                                    </td>
                                </tr>
                             ) : events.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-8 px-4 text-center text-text-secondary-dark">
                                        No security events found
                                    </td>
                                </tr>
                             ) : (
                                events.slice(0, 10).map((event) => {
                                  const isWarning = event.severity === 'high' || event.severity === 'critical'
                                  return (
                                    <tr key={event.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="py-3 px-4 text-text-secondary-dark">{formatEventTime(event.created_at)}</td>
                                        <td className={`py-3 px-4 ${isWarning ? getSeverityColor(event.severity) + ' font-sans flex items-center gap-2' : 'text-text-primary-dark font-sans group-hover:text-primary transition-colors'}`}>
                                            {isWarning && <AlertTriangle className="h-3 w-3 inline" />}
                                            {event.description || event.event_type || 'Security event'}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase ${isWarning ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-text-secondary-dark/10 text-text-secondary-dark border border-text-secondary-dark/20'}`}>
                                                {event.severity || 'medium'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-text-secondary-dark text-right opacity-70">{event.ip_address || 'N/A'}</td>
                                    </tr>
                                  )
                                })
                             )}
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

                {analytics && analytics.recent_events && analytics.recent_events.some(e => e.severity === 'critical') && (
                    <Card className="bg-surface-dark border-error/30 rounded p-4 relative overflow-hidden shadow-sm">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-error"></div>
                        <div className="flex items-start gap-3 pl-2">
                            <AlertTriangle className="h-5 w-5 text-error" />
                            <div>
                                <h4 className="text-xs font-bold text-text-primary-dark uppercase tracking-wide">Critical Events Detected</h4>
                                <p className="text-[10px] text-text-secondary-dark mt-1 leading-relaxed">
                                    {analytics.recent_events.filter(e => e.severity === 'critical').length} critical security event{analytics.recent_events.filter(e => e.severity === 'critical').length !== 1 ? 's' : ''} detected. Review audit logs immediately.
                                </p>
                                <button className="mt-2 text-[10px] bg-error/10 hover:bg-error/20 text-error px-2 py-1 rounded border border-error/20 transition-colors font-semibold uppercase tracking-wide">
                                    View Details
                                </button>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
       </div>
    </div>
  )
}

