import React, { useState, useMemo } from 'react'
import { ShieldCheck, Shield, Settings, Loader2, Network, Cpu, Search, Ban, CheckCircle, Edit, X } from 'lucide-react'
import { Card } from '@/shared/ui/components/card'
import { Button } from '@/shared/ui/components/button'
import { Input } from '@/shared/ui/components/input'
import { Switch } from '@/shared/ui/components/switch'
import { useSecurityData } from './hooks/use-security-data'
import { useBlockedIPs, useBlockedHWIDs } from '@/features/security-rules/hooks/use-security-query'
import { format } from 'date-fns'
import type { BlockedIP, BlockedHWID } from '@/shared/api/security'

function formatBanDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return format(date, 'yyyy-MM-dd HH:mm')
  } catch {
    return dateString
  }
}

type BanType = 'IP' | 'HWID'

export function SecurityPage() {
  const {
    error,
    calculateSecurityScore,
  } = useSecurityData()

  // Ban management state
  const [activeTab, setActiveTab] = useState<BanType>('IP')
  const [rateLimit, setRateLimit] = useState(100)
  const [vpnBlock, setVpnBlock] = useState(true)
  const [vmBlock, setVmBlock] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch blocked IPs and HWIDs
  const { blockedIPs, loading: loadingIPs, unblockIP } = useBlockedIPs()
  const { blockedHWIDs, loading: loadingHWIDs, unblockHWID } = useBlockedHWIDs()

  const securityScore = calculateSecurityScore()

  // Filter and search bans
  const filteredBans = useMemo(() => {
    const bans = activeTab === 'IP' 
      ? blockedIPs.filter(ip => ip.is_active).map(ip => ({
          id: ip.id.toString(),
          value: ip.ip_address,
          reason: ip.reason,
          date: formatBanDate(ip.blocked_at),
          admin: ip.blocked_by || 'system',
          type: 'IP' as BanType,
          original: ip
        }))
      : blockedHWIDs.filter(hwid => hwid.is_active).map(hwid => ({
          id: hwid.id.toString(),
          value: hwid.hwid,
          reason: hwid.reason,
          date: formatBanDate(hwid.blocked_at),
          admin: hwid.blocked_by || 'system',
          type: 'HWID' as BanType,
          original: hwid
        }))
    
    if (!searchQuery.trim()) return bans
    
    const query = searchQuery.toLowerCase()
    return bans.filter(ban => 
      ban.value.toLowerCase().includes(query) ||
      ban.reason.toLowerCase().includes(query) ||
      ban.admin.toLowerCase().includes(query)
    )
  }, [activeTab, blockedIPs, blockedHWIDs, searchQuery])

  const handleUnblock = async (ban: { id: string; type: BanType; original: BlockedIP | BlockedHWID }) => {
    try {
      if (ban.type === 'IP' && 'ip_address' in ban.original) {
        await unblockIP(ban.original.id)
      } else if (ban.type === 'HWID' && 'hwid' in ban.original) {
        await unblockHWID(ban.original.id)
      }
    } catch (error) {
      console.error('Failed to unblock:', error)
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <Card className="bg-error/10 border-error/20 rounded p-4">
          <div className="text-sm text-error">{error}</div>
        </Card>
      )}

       {/* Security Manager Section */}
       <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] animate-in fade-in duration-500">
            
            {/* LEFT COLUMN: GLOBAL SETTINGS */}
            <div className="w-full lg:w-80 flex flex-col gap-6">
                
                {/* Status Card */}
                <Card className="bg-surface-dark border-border-dark rounded-sm p-5 relative overflow-hidden group">
                     <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <ShieldCheck className="text-9xl" />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                             <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                                <Shield className="text-xl" />
                             </div>
                             <div>
                                 <h3 className="text-sm font-bold text-white uppercase tracking-wide">System Armed</h3>
                                 <p className="text-[10px] text-text-secondary-dark">Threat detection active</p>
                             </div>
                        </div>
                        <div className="h-1 w-full bg-background-dark rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-emerald-500" style={{ width: `${securityScore}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[9px] font-mono text-text-secondary-dark uppercase tracking-wider">
                            <span>Score: {securityScore}/100</span>
                            <span>Uptime: 14d</span>
                        </div>
                    </div>
                </Card>

                {/* Threat Mitigation Controls */}
                <Card className="bg-surface-dark border-border-dark rounded-sm flex-1 flex flex-col">
                    <div className="p-4 border-b border-border-dark">
                         <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Settings className="text-primary h-4 w-4" />
                            Mitigation Rules
                        </h3>
                    </div>

                    <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar">
                        
                        {/* VPN Blocker */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-[11px] font-bold text-white">Block VPN / Proxy</div>
                                <div className="text-[10px] text-text-secondary-dark leading-tight mt-0.5">Deny known datacenter IPs.</div>
                            </div>
                            <Switch 
                                checked={vpnBlock}
                                onCheckedChange={setVpnBlock}
                                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-border-dark"
                            />
                        </div>

                         {/* VM Blocker */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-[11px] font-bold text-white">Block Virtual Machines</div>
                                <div className="text-[10px] text-text-secondary-dark leading-tight mt-0.5">Detect VMWare, KVM, etc.</div>
                            </div>
                             <Switch 
                                checked={vmBlock}
                                onCheckedChange={setVmBlock}
                                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-border-dark"
                            />
                        </div>

                        <div className="h-px bg-border-dark/50"></div>

                        {/* Rate Limiting */}
                        <div>
                             <div className="flex justify-between items-center mb-2">
                                <div className="text-[11px] font-bold text-white">Rate Limiting</div>
                                <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 rounded">{rateLimit} req/m</span>
                             </div>
                             <input 
                                type="range" 
                                min="10" 
                                max="1000" 
                                value={rateLimit} 
                                onChange={(e) => setRateLimit(parseInt(e.target.value))}
                                className="w-full h-1 bg-background-dark rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
                             />
                             <div className="text-[9px] text-text-secondary-dark mt-2">
                                Threshold for automated IP bans.
                             </div>
                        </div>

                         <div className="h-px bg-border-dark/50"></div>

                         {/* Geo Restriction */}
                         <div>
                             <div className="text-[11px] font-bold text-white mb-2">Geo-Restriction</div>
                             <div className="flex flex-wrap gap-2">
                                 {['CN', 'RU', 'NK'].map(c => (
                                     <span key={c} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono flex items-center gap-1 group cursor-pointer hover:bg-red-500/20">
                                         {c} <X className="text-[10px] opacity-50 group-hover:opacity-100 h-3 w-3" />
                                     </span>
                                 ))}
                                 <button className="text-[10px] bg-background-dark border border-border-dark text-text-secondary-dark px-2 py-0.5 rounded hover:text-white transition-colors">+ Add</button>
                             </div>
                         </div>
                    </div>
                </Card>
            </div>

            {/* RIGHT COLUMN: BAN MANAGEMENT */}
            <div className="flex-1 bg-surface-dark border border-border-dark rounded-sm flex flex-col overflow-hidden">
                
                {/* Header / Tabs */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border-dark bg-[#161920]">
                    <div className="flex items-center gap-6">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                             <Settings className="text-text-secondary-dark h-4 w-4" />
                             Access Control Lists
                        </h2>
                        <div className="h-4 w-px bg-border-dark"></div>
                        <div className="flex gap-1">
                             <Button 
                                onClick={() => setActiveTab('IP')}
                                variant={activeTab === 'IP' ? 'default' : 'ghost'}
                                size="sm"
                                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm ${activeTab === 'IP' ? 'bg-primary text-background-dark border-primary' : 'bg-transparent text-text-secondary-dark border-transparent hover:bg-white/5'}`}
                            >
                                Blocked IPs
                            </Button>
                            <Button 
                                onClick={() => setActiveTab('HWID')}
                                variant={activeTab === 'HWID' ? 'default' : 'ghost'}
                                size="sm"
                                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm ${activeTab === 'HWID' ? 'bg-primary text-background-dark border-primary' : 'bg-transparent text-text-secondary-dark border-transparent hover:bg-white/5'}`}
                            >
                                Blocked HWIDs
                            </Button>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                         <div className="relative group w-64">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                              <Search className="h-3.5 w-3.5 text-text-secondary-dark group-focus-within:text-primary transition-colors" />
                            </span>
                            <Input 
                                className="w-full bg-background-dark border border-border-dark rounded-sm pl-9 pr-3 py-1.5 text-[10px] text-text-secondary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark/40 h-auto" 
                                placeholder={`Search ${activeTab}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                         </div>
                         <Button 
                            variant="destructive"
                            size="sm"
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider"
                        >
                             <Ban className="text-sm h-3 w-3" />
                             Ban {activeTab}
                         </Button>
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto bg-[#0F1115]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#12141a] sticky top-0 z-10 text-[9px] text-text-secondary-dark uppercase tracking-widest font-bold font-mono">
                            <tr>
                                <th className="px-6 py-3 border-b border-border-dark">Target Value</th>
                                <th className="px-6 py-3 border-b border-border-dark">Reason</th>
                                <th className="px-6 py-3 border-b border-border-dark">Date Added</th>
                                <th className="px-6 py-3 border-b border-border-dark">Admin</th>
                                <th className="px-6 py-3 border-b border-border-dark text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] font-mono">
                            {loadingIPs || loadingHWIDs ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-text-secondary-dark">
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                        Loading...
                                    </td>
                                </tr>
                            ) : filteredBans.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-text-secondary-dark opacity-40">
                                        <CheckCircle className="text-4xl mb-2 mx-auto h-10 w-10" />
                                        <p className="text-xs uppercase tracking-widest">No Active Bans</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredBans.map((ban) => (
                                    <tr key={ban.id} className="border-b border-border-dark/40 hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                {ban.type === 'IP' ? (
                                                    <Network className="text-xs text-text-secondary-dark opacity-50 h-4 w-4" />
                                                ) : (
                                                    <Cpu className="text-xs text-text-secondary-dark opacity-50 h-4 w-4" />
                                                )}
                                                <span className="text-white select-all">{ban.value}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-text-secondary-dark">
                                            <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] border border-border-dark">{ban.reason}</span>
                                        </td>
                                        <td className="px-6 py-3 text-text-secondary-dark opacity-80">{ban.date}</td>
                                        <td className="px-6 py-3 text-text-secondary-dark opacity-80">{ban.admin}</td>
                                        <td className="px-6 py-3 text-right">
                                            <button 
                                                onClick={() => handleUnblock(ban)}
                                                className="text-text-secondary-dark hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100 mr-2" 
                                                title="Revoke Ban"
                                            >
                                                <CheckCircle className="text-base h-4 w-4" />
                                            </button>
                                            <button 
                                                className="text-text-secondary-dark hover:text-white transition-colors opacity-0 group-hover:opacity-100" 
                                                title="Edit Reason"
                                            >
                                                <Edit className="text-base h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  )
}

