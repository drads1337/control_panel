import React from 'react'
import { StatCard } from '@/app/dashboard/stat-card'
import { Shield, Ban, Globe, Monitor } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface SecurityStatsCardsProps {
  stats: {
    totalBlocks: number
    activeBlocks: number
    blockedIPs: number
    blockedHWIDs: number
  }
  loading?: boolean
  canViewIPs?: boolean
  canViewHWIDs?: boolean
}

export default function SecurityStatsCards({ stats, loading = false, canViewIPs = true, canViewHWIDs = true }: SecurityStatsCardsProps) {

  const showTotalCard = canViewIPs || canViewHWIDs
  const showActiveCard = canViewIPs || canViewHWIDs
  const showIPCard = canViewIPs
  const showHWIDCard = canViewHWIDs

  const visibleCards = [showTotalCard, showActiveCard, showIPCard, showHWIDCard].filter(Boolean).length

  if (loading) {
    return (
      <div 
        className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
        style={{gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'}}
      >
        {[...Array(visibleCards)].map((_, i) => (
          <Card key={i} className="@container/card">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                Loading...
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">...</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div 
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      style={{gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'}}
    >
      {showTotalCard && (
        <StatCard
          title="Total Blocks"
          value={stats.totalBlocks}
          icon={Shield}
          badge={{
            text: "All time blocks",
            color: "primary"
          }}
          footer={{
            description: "Security management system",
            details: `${stats.totalBlocks} total blocks`,
            icon: Shield
          }}
        />
      )}

      {showActiveCard && (
        <StatCard
          title="Active Blocks"
          value={stats.activeBlocks}
          icon={Ban}
          badge={{
            text: "Currently blocked",
            color: "primary"
          }}
          footer={{
            description: "Active security blocks",
            details: `${stats.activeBlocks} active restrictions`,
            icon: Ban
          }}
        />
      )}

      {showIPCard && (
        <StatCard
          title="Blocked IPs"
          value={stats.blockedIPs}
          icon={Globe}
          badge={{
            text: "IP addresses",
            color: "primary"
          }}
          footer={{
            description: "IP address management",
            details: `${stats.blockedIPs} blocked IP addresses`,
            icon: Globe
          }}
        />
      )}

      {showHWIDCard && (
        <StatCard
          title="Blocked HWIDs"
          value={stats.blockedHWIDs}
          icon={Monitor}
          badge={{
            text: "Hardware IDs",
            color: "primary"
          }}
          footer={{
            description: "Hardware ID management",
            details: `${stats.blockedHWIDs} blocked hardware IDs`,
            icon: Monitor
          }}
        />
      )}
    </div>
  )
}
