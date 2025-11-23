import { StatCard } from './stat-card'
import { Users, Key, Database, Server, Building2, DollarSign } from 'lucide-react'
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
        title: 'Products',
        value: data.overview.products.total,
        icon: Database,
        subtitle: data.overview.products.active > 0 ? `${data.overview.products.active} active` : 'No products yet',
        badge: {
          text: `${data.overview.products.active} active`,
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
            valueClassName="text-xs xs:text-sm font-semibold sm:text-base md:text-lg"
            className="[&_header]:!p-2 [&_header]:sm:!p-3 [&_header]:!pb-1 [&_header]:sm:!pb-1.5 [&_h2]:!text-xs [&_h2]:xs:!text-sm [&_h2]:sm:!text-base [&_h2]:!mb-0 [&_h2]:!leading-tight [&_p]:!text-[10px] [&_p]:xs:!text-xs [&_p]:!mb-0 [&_p]:!leading-tight [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:xs:!h-3.5 [&_svg]:xs:!w-3.5 [&_svg]:sm:!h-4 [&_svg]:sm:!w-4 [&_span]:!text-[10px] [&_span]:xs:!text-xs [&_span]:!px-1 [&_span]:xs:!px-1.5 [&_span]:!py-0 [&_span]:!leading-tight"
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
            valueClassName="text-xs xs:text-sm font-semibold sm:text-base md:text-lg"
            className="[&_header]:!p-2 [&_header]:sm:!p-3 [&_header]:!pb-1 [&_header]:sm:!pb-1.5 [&_h2]:!text-xs [&_h2]:xs:!text-sm [&_h2]:sm:!text-base [&_h2]:!mb-0 [&_h2]:!leading-tight [&_p]:!text-[10px] [&_p]:xs:!text-xs [&_p]:!mb-0 [&_p]:!leading-tight [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:xs:!h-3.5 [&_svg]:xs:!w-3.5 [&_svg]:sm:!h-4 [&_svg]:sm:!w-4 [&_span]:!text-[10px] [&_span]:xs:!text-xs [&_span]:!px-1 [&_span]:xs:!px-1.5 [&_span]:!py-0 [&_span]:!leading-tight"
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

  // Горизонтальный скролл на мобильных, сетка на больших экранах
  return (
    <div className="w-full">
      {/* Мобильная версия с горизонтальным скроллом */}
      <div className="flex gap-2 xs:gap-2.5 sm:hidden overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
        <div className="flex gap-2 xs:gap-2.5 min-w-max *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs *:min-w-[140px] *:flex-shrink-0">
          {renderCards()}
        </div>
      </div>
      {/* Десктопная версия с сеткой */}
      <div 
        className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      >
        {renderCards()}
      </div>
    </div>
  )
}
