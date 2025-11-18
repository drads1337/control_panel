import React, { useMemo, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, Globe, Monitor, Settings } from 'lucide-react'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import SecurityStatsCards from './security-stats-cards'
import BlockedIPsList from './blocked-ips-list'
import BlockedHWIDsList from './blocked-hwids-list'
import SecurityRules from './security-rules'

interface BlockedIP {
  id: number
  ip_address: string
  reason: string
  blocked_at: string
  expires_at?: string
  is_active: boolean
  block_type: string
  category: string
  severity: string
  threat_score: number
  country?: string
  city?: string
  attempt_count: number
  blocked_by?: string
  unblocked_at?: string
  unblocked_by?: string
}

interface BlockedHWID {
  id: number
  hwid: string
  reason: string
  blocked_at: string
  expires_at?: string
  is_active: boolean
  block_type: string
  category: string
  severity: string
  threat_score: number
  cpu_info?: string
  gpu_info?: string
  motherboard_info?: string
  ram_info?: string
  attempt_count: number
  blocked_by?: string
  unblocked_at?: string
  unblocked_by?: string
}

interface SecurityTabsProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  stats: {
    totalBlocks: number
    activeBlocks: number
    blockedIPs: number
    blockedHWIDs: number
    threatLevel: string
    recentThreats: number
  }
  blockedIPs: BlockedIP[]
  blockedHWIDs: BlockedHWID[]
  loading: boolean
  ipSearchTerm: string
  setIPSearchTerm: (term: string) => void
  hwidSearchTerm: string
  setHWIDSearchTerm: (term: string) => void
  onUnblockIP: (ipId: number) => void
  onUnblockHWID: (hwidId: number) => void
  onViewIPDetails: (ip: BlockedIP) => void
  onViewHWIDDetails: (hwid: BlockedHWID) => void
  onBlockIP: (data: any) => void
  onBlockHWID: (data: any) => void
}

export default function SecurityTabs({
  activeTab,
  setActiveTab,
  stats,
  blockedIPs,
  blockedHWIDs,
  loading,
  ipSearchTerm,
  setIPSearchTerm,
  hwidSearchTerm,
  setHWIDSearchTerm,
  onUnblockIP,
  onUnblockHWID,
  onViewIPDetails,
  onViewHWIDDetails,
  onBlockIP,
  onBlockHWID
}: SecurityTabsProps) {
  const {
    canViewIPs,
    canBlockIPs,
    canUnblockIPs,
    canViewHWIDs,
    canBlockHWIDs,
    canUnblockHWIDs,
    canManageRules
  } = useSecurityPermissions();

  const availableTabs = useMemo(() => {
    const tabs: Array<{
      value: string
      label: string
      icon: React.ComponentType<{ className?: string }>
    }> = []
    if (canViewIPs) {
      tabs.push({
        value: 'blocked-ips',
        label: 'Blocked IPs',
        icon: Globe
      })
    }
    if (canViewHWIDs) {
      tabs.push({
        value: 'blocked-hwids',
        label: 'Blocked HWIDs',
        icon: Monitor
      })
    }
    if (canManageRules) {
      tabs.push({
        value: 'rules',
        label: 'Rules',
        icon: Settings
      })
    }
    return tabs
  }, [canViewIPs, canViewHWIDs, canManageRules])

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.value === activeTab)) {
      setActiveTab(availableTabs[0].value)
    }
  }, [activeTab, availableTabs, setActiveTab])

  if (availableTabs.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {}
      <SecurityStatsCards 
        stats={stats} 
        loading={loading}
        canViewIPs={canViewIPs}
        canViewHWIDs={canViewHWIDs}
      />

      {}
      {availableTabs.length > 0 && (
      <>
        {availableTabs.length > 1 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full h-14 bg-muted border border-border rounded-lg mb-6`} style={{gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)`}}>
              {availableTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <TabsTrigger 
                    key={tab.value}
                    value={tab.value} 
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {canViewIPs && (
              <TabsContent value="blocked-ips" className="space-y-6">
                <BlockedIPsList
                  blockedIPs={blockedIPs}
                  loading={loading}
                  searchTerm={ipSearchTerm}
                  setSearchTerm={setIPSearchTerm}
                  onUnblockIP={onUnblockIP}
                  onViewDetails={onViewIPDetails}
                  onBlockIP={onBlockIP}
                />
              </TabsContent>
            )}

            {canViewHWIDs && (
              <TabsContent value="blocked-hwids" className="space-y-6">
                <BlockedHWIDsList
                  blockedHWIDs={blockedHWIDs}
                  loading={loading}
                  searchTerm={hwidSearchTerm}
                  setSearchTerm={setHWIDSearchTerm}
                  onUnblockHWID={onUnblockHWID}
                  onViewDetails={onViewHWIDDetails}
                  onBlockHWID={onBlockHWID}
                />
              </TabsContent>
            )}

            {canManageRules && (
              <TabsContent value="rules" className="space-y-6">
                <SecurityRules />
              </TabsContent>
            )}
          </Tabs>
        ) : (

          <>
            {canViewIPs && activeTab === 'blocked-ips' && (
              <div className="space-y-6">
                <BlockedIPsList
                  blockedIPs={blockedIPs}
                  loading={loading}
                  searchTerm={ipSearchTerm}
                  setSearchTerm={setIPSearchTerm}
                  onUnblockIP={onUnblockIP}
                  onViewDetails={onViewIPDetails}
                  onBlockIP={onBlockIP}
                />
              </div>
            )}
            {canViewHWIDs && activeTab === 'blocked-hwids' && (
              <div className="space-y-6">
                <BlockedHWIDsList
                  blockedHWIDs={blockedHWIDs}
                  loading={loading}
                  searchTerm={hwidSearchTerm}
                  setSearchTerm={setHWIDSearchTerm}
                  onUnblockHWID={onUnblockHWID}
                  onViewDetails={onViewHWIDDetails}
                  onBlockHWID={onBlockHWID}
                />
              </div>
            )}
            {canManageRules && activeTab === 'rules' && (
              <div className="space-y-6">
                <SecurityRules />
              </div>
            )}
          </>
        )}
      </>
      )}
    </div>
  )
}
