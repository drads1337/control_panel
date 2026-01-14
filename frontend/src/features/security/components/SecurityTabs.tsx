import React, { useMemo, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import SecurityStatsCards from './SecurityStatsCards'
import BlockedIPsList from './BlockedIPsList'
import BlockedHWIDsList from './BlockedHWIDsList'
import SecurityRules from './SecurityRules'

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
    canViewHWIDs,
    canManageRules
  } = useSecurityPermissions();

  const availableTabs = useMemo(() => {
    const tabs: Array<{
      value: string
      label: string
    }> = []
    if (canViewHWIDs) {
      tabs.push({
        value: 'blocked-hwids',
        label: 'Blocked HWIDs',
      })
    }
    if (canViewIPs) {
      tabs.push({
        value: 'blocked-ips',
        label: 'Blocked IPs',
      })
    }
    if (canManageRules) {
      tabs.push({
        value: 'rules',
        label: 'Rules',
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
    <div className="flex flex-col gap-3 md:gap-4">
      <SecurityStatsCards 
        stats={stats} 
        loading={loading}
        canViewIPs={canViewIPs}
        canViewHWIDs={canViewHWIDs}
      />

      {availableTabs.length > 0 && (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex-col justify-start gap-4"
        >
          <div className="flex items-center justify-between px-4 lg:px-6">
            <Label htmlFor="view-selector" className="sr-only">
              View
            </Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger
                className="flex w-fit h-7 text-xs @4xl/main:hidden"
                size="sm"
                id="view-selector"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {availableTabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value} className="text-xs">
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden h-8 **:data-[slot=badge]:size-4 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 **:data-[slot=tabs-trigger]:text-xs @4xl/main:flex">
              {availableTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {canViewHWIDs && (
            <TabsContent
              value="blocked-hwids"
              className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
            >
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
            <TabsContent
              value="blocked-ips"
              className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
            >
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
            <TabsContent
              value="rules"
              className="relative flex flex-col gap-3 overflow-auto px-4 lg:px-6"
            >
              <SecurityRules onRefresh={onRefreshRules} loading={loading} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  )
}

