import React, { useMemo, useEffect } from 'react'
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
import { Shield, Globe, Monitor, Settings } from 'lucide-react'
import { useSecurityPermissions } from '@/app/providers/security-permissions-provider'
import SecurityStatsCards from '@/features/security-rules/security-stats-cards'
import BlockedIPsList from './blocked-ips-list'
import BlockedHWIDsList from './blocked-hwids-list'
import SecurityRules from '@/features/security-rules/security-rules'

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
  onRefreshIPs?: () => void
  onRefreshHWIDs?: () => void
  onRefreshRules?: () => void
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
  onBlockHWID,
  onRefreshIPs,
  onRefreshHWIDs,
  onRefreshRules
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
    if (canViewHWIDs) {
      tabs.push({
        value: 'blocked-hwids',
        label: 'Blocked HWIDs',
        icon: Monitor
      })
    }
    if (canViewIPs) {
      tabs.push({
        value: 'blocked-ips',
        label: 'Blocked IPs',
        icon: Globe
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

  const hasBlockedData = (canViewIPs && blockedIPs.length > 0) || (canViewHWIDs && blockedHWIDs.length > 0);

  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
      {hasBlockedData && (
        <SecurityStatsCards 
          stats={stats} 
          loading={loading}
          canViewIPs={canViewIPs}
          canViewHWIDs={canViewHWIDs}
        />
      )}

      {availableTabs.length > 0 && (
        <>
          {availableTabs.length > 1 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="relative mb-3 xs:mb-4">
                <TabsList className={`grid w-full h-12 xs:h-14 bg-muted border border-border rounded-lg p-1`} style={{gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)`}}>
                  {availableTabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <TabsTrigger 
                        key={tab.value}
                        value={tab.value} 
                        className="flex items-center justify-center gap-2"
                      >
                        <Icon className="h-4 w-4 md:h-4 md:w-4" />
                        <span className="hidden md:inline">{tab.label}</span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              <TabsContents>
                {canViewHWIDs && (
                  <TabsContent value="blocked-hwids" className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
                    <BlockedHWIDsList
                      blockedHWIDs={blockedHWIDs}
                      loading={loading}
                      searchTerm={hwidSearchTerm}
                      setSearchTerm={setHWIDSearchTerm}
                      onUnblockHWID={onUnblockHWID}
                      onViewDetails={onViewHWIDDetails}
                      onBlockHWID={onBlockHWID}
                      onRefresh={onRefreshHWIDs}
                    />
                  </TabsContent>
                )}

                {canViewIPs && (
                  <TabsContent value="blocked-ips" className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
                    <BlockedIPsList
                      blockedIPs={blockedIPs}
                      loading={loading}
                      searchTerm={ipSearchTerm}
                      setSearchTerm={setIPSearchTerm}
                      onUnblockIP={onUnblockIP}
                      onViewDetails={onViewIPDetails}
                      onBlockIP={onBlockIP}
                      onRefresh={onRefreshIPs}
                    />
                  </TabsContent>
                )}

                {canManageRules && (
                  <TabsContent value="rules" className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
                    <SecurityRules onRefresh={onRefreshRules} loading={loading} />
                  </TabsContent>
                )}
              </TabsContents>
            </Tabs>
          ) : (
            <>
              {canViewHWIDs && activeTab === 'blocked-hwids' && (
                <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 mt-3 xs:mt-4">
                  <BlockedHWIDsList
                    blockedHWIDs={blockedHWIDs}
                    loading={loading}
                    searchTerm={hwidSearchTerm}
                    setSearchTerm={setHWIDSearchTerm}
                    onUnblockHWID={onUnblockHWID}
                    onViewDetails={onViewHWIDDetails}
                    onBlockHWID={onBlockHWID}
                    onRefresh={onRefreshHWIDs}
                  />
                </div>
              )}
              {canViewIPs && activeTab === 'blocked-ips' && (
                <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 mt-3 xs:mt-4">
                  <BlockedIPsList
                    blockedIPs={blockedIPs}
                    loading={loading}
                    searchTerm={ipSearchTerm}
                    setSearchTerm={setIPSearchTerm}
                    onUnblockIP={onUnblockIP}
                    onViewDetails={onViewIPDetails}
                    onBlockIP={onBlockIP}
                    onRefresh={onRefreshIPs}
                  />
                </div>
              )}
              {canManageRules && activeTab === 'rules' && (
                <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 mt-3 xs:mt-4">
                  <SecurityRules onRefresh={onRefreshRules} loading={loading} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
