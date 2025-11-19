import { StatCard } from './stat-card'
import { Users, Key, Gamepad2, Server, Building2, DollarSign } from 'lucide-react'
import { DashboardData } from '@/hooks/use-dashboard-stats'
import { OwnerDashboardStats } from '@/hooks/use-owner-dashboard'

interface StatCardsGridProps {
  data?: DashboardData | OwnerDashboardStats | null
  type: 'dashboard' | 'owner'
}

export function StatCardsGrid({ data, type }: StatCardsGridProps) {
  if (!data) return null

  const renderDashboardCards = (data: DashboardData) => {
    const statCards = [
      {
        title: 'Users',
        value: data.overview.users.total,
        icon: Users,
        subtitle: data.overview.users.total > 0 ? `${data.overview.users.new_today} new today` : 'No users yet',
        badge: {
          text: `${data.overview.users.active} active`,
          color: 'primary' as const
        }
      },
      {
        title: 'License Keys',
        value: data.overview.keys.total,
        icon: Key,
        subtitle: data.overview.keys.expired > 0 ? `${data.overview.keys.expired} expired keys` : 'All keys active',
        badge: {
          text: `${data.overview.keys.active} active`,
          color: 'primary' as const
        }
      },
      {
        title: 'Games',
        value: data.overview.games.total,
        icon: Gamepad2,
        subtitle: data.overview.games.active > 0 ? `${data.overview.games.active} active` : 'No games yet',
        badge: {
          text: `${data.overview.games.active} active`,
          color: 'primary' as const
        }
      },
      {
        title: 'Servers',
        value: data.overview.servers.total,
        icon: Server,
        subtitle: data.overview.servers.offline > 0 ? `${data.overview.servers.offline} offline` : 'All servers online',
        badge: {
          text: `${data.overview.servers.online} online`,
          color: 'primary' as const
        }
      }
    ];

    return (
      <>
        {statCards.map((stat, index) => (
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
        ))}
      </>
    );
  }

  const renderOwnerCards = (data: OwnerDashboardStats) => {
    const statCards = [
      {
        title: 'Projects',
        value: data.system_overview.total_projects,
        icon: Building2,
        subtitle: data.system_overview.active_projects > 0 ? `${data.system_overview.active_projects} active` : 'No projects yet',
        badge: {
          text: `${data.system_overview.active_projects} active`,
          color: 'primary' as const
        }
      },
      {
        title: 'Total Users',
        value: data.system_overview.total_users,
        icon: Users,
        subtitle: data.user_analytics.new_today > 0 ? `${data.user_analytics.new_today} new today` : 'No new users today',
        badge: {
          text: `${data.system_overview.active_users} active`,
          color: 'primary' as const
        }
      },
      {
        title: 'License Keys',
        value: data.system_overview.total_keys,
        icon: Key,
        subtitle: data.system_overview.active_keys > 0 ? `${data.system_overview.active_keys} active` : 'No keys yet',
        badge: {
          text: `${data.system_overview.active_keys} active`,
          color: 'primary' as const
        }
      },
      {
        title: 'Revenue',
        value: `$${data.system_overview.total_revenue.toLocaleString()}`,
        icon: DollarSign,
        subtitle: `$${data.system_overview.monthly_revenue.toLocaleString()} this month`,
        badge: {
          text: 'All Projects',
          color: 'primary' as const
        }
      }
    ];

    return (
      <>
        {statCards.map((stat, index) => (
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
        ))}
      </>
    );
  }

  const renderCards = () => {
    switch (type) {
      case 'dashboard':
        return renderDashboardCards(data as DashboardData)
      case 'owner':
        return renderOwnerCards(data as OwnerDashboardStats)
      default:
        return null
    }
  }

  // Компактный стиль как в users-stats.tsx
  const gridStyle = { gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' };

  return (
    <div 
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-2 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      style={gridStyle}
    >
      {renderCards()}
    </div>
  )
}
