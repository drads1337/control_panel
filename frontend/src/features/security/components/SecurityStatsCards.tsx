import React from 'react'
import { Card, CardContent, CardHeader, CardDescription, CardTitle, CardAction, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

  if (loading) {
    return (
      <div 
        className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 md:grid-cols-4 gap-3 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6"
      >
        {[...Array(visibleCards)].map((_, i) => (
          <Card key={i} className="@container/card p-3">
            <CardHeader className="p-0 pb-1">
              <div className="h-3 w-16 bg-muted animate-pulse rounded mb-1"></div>
              <div className="h-6 w-12 bg-muted animate-pulse rounded mb-1"></div>
              <div className="h-5 w-20 bg-muted animate-pulse rounded"></div>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
              <div className="h-3 w-24 bg-muted animate-pulse rounded"></div>
              <div className="h-3 w-32 bg-muted animate-pulse rounded"></div>
            </CardFooter>
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
      },
      description: 'Total blocks in system'
    },
    showActiveCard && {
      title: 'Active',
      value: stats.activeBlocks,
      icon: Ban,
      subtitle: 'Currently active blocks',
      badge: {
        text: 'Active',
        color: 'primary'
      },
      description: 'Currently active blocks'
    },
    showIPCard && {
      title: 'Blocked IPs',
      value: stats.blockedIPs,
      icon: Globe,
      subtitle: stats.totalBlocks > 0 && stats.blockedIPs > 0 ? `${Math.round((stats.blockedIPs / stats.totalBlocks) * 100) || 0}% of total` : stats.blockedIPs === 0 ? 'No IP blocks' : 'Calculating...',
      badge: {
        text: 'IPs',
        color: 'primary'
      },
      description: 'Blocked IP addresses'
    },
    showHWIDCard && {
      title: 'Blocked HWIDs',
      value: stats.blockedHWIDs,
      icon: Monitor,
      subtitle: stats.totalBlocks > 0 && stats.blockedHWIDs > 0 ? `${Math.round((stats.blockedHWIDs / stats.totalBlocks) * 100) || 0}% of total` : stats.blockedHWIDs === 0 ? 'No HWID blocks' : 'Calculating...',
      badge: {
        text: 'HWIDs',
        color: 'primary'
      },
      description: 'Blocked hardware IDs'
    }
  ].filter(Boolean)

  return (
    <div 
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 md:grid-cols-4 gap-3 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6"
    >
      {statCards.map((stat, index) => {
        if (!stat) return null
        const Icon = stat.icon
        return (
          <Card key={index} className="@container/card p-3">
            <CardHeader className="p-0 pb-1">
              <CardDescription className="text-xs">{stat.title}</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                {stat.value}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="text-xs h-5 px-1.5">
                  <Icon className="size-3" />
                  {stat.badge.text}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
              <div className="line-clamp-1 flex gap-1.5 font-medium">
                {stat.subtitle}{" "}
                <Icon className="size-3" />
              </div>
              <div className="text-muted-foreground">
                {stat.description}
              </div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
})

SecurityStatsCards.displayName = 'SecurityStatsCards'

export default SecurityStatsCards

