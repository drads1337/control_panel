import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatCard } from '@/app/dashboard/stat-card'
import { Shield, Ban, Globe, Monitor } from 'lucide-react'

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

const SecurityStatsCards: React.FC<SecurityStatsCardsProps> = React.memo(({ stats, loading = false, canViewIPs = true, canViewHWIDs = true }) => {
  const showTotalCard = canViewIPs || canViewHWIDs
  const showActiveCard = canViewIPs || canViewHWIDs
  const showIPCard = canViewIPs
  const showHWIDCard = canViewHWIDs

  const visibleCards = [showTotalCard, showActiveCard, showIPCard, showHWIDCard].filter(Boolean).length

  // Уменьшаем размер сетки до 120px для компактности
  const gridStyle = { gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }

  if (loading) {
    return (
      <div 
        className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-2 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
        style={gridStyle}
      >
        {[...Array(visibleCards)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-1.5 pb-0.5">
              <div className="h-2 w-8 bg-muted animate-pulse rounded"></div>
              <div className="h-2 w-2 bg-muted animate-pulse rounded"></div>
            </CardHeader>
            <CardContent className="p-1.5 pt-0">
              <div className="h-3.5 w-6 bg-muted animate-pulse rounded mb-0.5"></div>
              <div className="h-1.5 w-10 bg-muted animate-pulse rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const statCards = [
    showTotalCard && {
      title: 'Total Blocks',
      value: stats.totalBlocks,
      icon: Shield,
      subtitle: stats.totalBlocks > 0 ? `${stats.activeBlocks} active` : 'No blocks yet',
      badge: {
        text: `${stats.activeBlocks} active`,
        color: 'primary'
      }
    },
    showActiveCard && {
      title: 'Active',
      value: stats.activeBlocks,
      icon: Ban,
      subtitle: 'Currently active blocks',
      badge: {
        text: 'Active',
        color: 'primary'
      }
    },
    showIPCard && {
      title: 'Blocked IPs',
      value: stats.blockedIPs,
      icon: Globe,
      subtitle: stats.totalBlocks > 0 && stats.blockedIPs > 0 ? `${Math.round((stats.blockedIPs / stats.totalBlocks) * 100) || 0}% of total` : stats.blockedIPs === 0 ? 'No IP blocks' : 'Calculating...',
      badge: {
        text: 'IPs',
        color: 'primary'
      }
    },
    showHWIDCard && {
      title: 'Blocked HWIDs',
      value: stats.blockedHWIDs,
      icon: Monitor,
      subtitle: stats.totalBlocks > 0 && stats.blockedHWIDs > 0 ? `${Math.round((stats.blockedHWIDs / stats.totalBlocks) * 100) || 0}% of total` : stats.blockedHWIDs === 0 ? 'No HWID blocks' : 'Calculating...',
      badge: {
        text: 'HWIDs',
        color: 'primary'
      }
    }
  ].filter(Boolean)

  return (
    <div 
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-2 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      style={gridStyle}
    >
      {statCards.map((stat, index) => {
        if (!stat) return null
        return (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            subtitle={stat.subtitle}
            badge={stat.badge}
            valueClassName="text-sm font-semibold sm:text-base"
            className="[&_header]:!p-1.5 [&_header]:!pb-0.5 [&_h2]:!text-sm [&_h2]:!mb-0 [&_p]:!text-xs [&_p]:!mb-0 [&_svg]:!h-3 [&_svg]:!w-3 [&_span]:!text-xs [&_span]:!px-1 [&_span]:!py-0"
          />
        )
      })}
    </div>
  )
})

SecurityStatsCards.displayName = 'SecurityStatsCards'

export default SecurityStatsCards
