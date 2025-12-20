import { StatCard } from './stat-card'
import { Users, Key, Database, Server, Building2, DollarSign } from 'lucide-react'
import { DashboardData } from '@/features/dashboard/hooks/use-dashboard-stats'
import { OwnerDashboardStats } from '@/features/dashboard/hooks/use-owner-dashboard'

interface StatCardsGridProps {
  data?: DashboardData | OwnerDashboardStats | null
  type: 'dashboard' | 'owner'
}

export function StatCardsGrid({ data, type }: StatCardsGridProps) {
  if (!data) return null

  // Определяем данные для рендера в зависимости от типа
  const getStatCards = () => {
    if (type === 'dashboard') {
      const d = data as DashboardData;
      return [
        {
          title: 'Users',
          value: d.overview.users.total,
          icon: Users,
          subtitle: d.overview.users.total > 0 ? `${d.overview.users.new_today} new today` : 'No users yet',
          badge: { text: `${d.overview.users.active} active`, color: 'primary' as const }
        },
        {
          title: 'License Keys',
          value: d.overview.keys.total,
          icon: Key,
          subtitle: d.overview.keys.expired > 0 ? `${d.overview.keys.expired} expired keys` : 'All keys active',
          badge: { text: `${d.overview.keys.active} active`, color: 'primary' as const }
        },
        {
          title: 'Products',
          value: d.overview.products.total,
          icon: Database,
          subtitle: d.overview.products.active > 0 ? `${d.overview.products.active} active` : 'No products yet',
          badge: { text: `${d.overview.products.active} active`, color: 'primary' as const }
        },
        {
          title: 'Servers',
          value: d.overview.servers.total,
          icon: Server,
          subtitle: d.overview.servers.offline > 0 ? `${d.overview.servers.offline} offline` : 'All servers online',
          badge: { text: `${d.overview.servers.online} online`, color: 'primary' as const }
        }
      ];
    } else {
      const d = data as OwnerDashboardStats;
      return [
        {
          title: 'Projects',
          value: d.system_overview.total_projects,
          icon: Building2,
          subtitle: d.system_overview.active_projects > 0 ? `${d.system_overview.active_projects} active` : 'No projects yet',
          badge: { text: `${d.system_overview.active_projects} active`, color: 'primary' as const }
        },
        {
          title: 'Total Users',
          value: d.system_overview.total_users,
          icon: Users,
          subtitle: d.user_analytics.new_today > 0 ? `${d.user_analytics.new_today} new today` : 'No new users today',
          badge: { text: `${d.system_overview.active_users} active`, color: 'primary' as const }
        },
        {
          title: 'License Keys',
          value: d.system_overview.total_keys,
          icon: Key,
          subtitle: d.system_overview.active_keys > 0 ? `${d.system_overview.active_keys} active` : 'No keys yet',
          badge: { text: `${d.system_overview.active_keys} active`, color: 'primary' as const }
        },
        {
          title: 'Revenue',
          value: `$${d.system_overview.total_revenue.toLocaleString()}`,
          icon: DollarSign,
          subtitle: `$${d.system_overview.monthly_revenue.toLocaleString()} this month`,
          badge: { text: 'All Projects', color: 'primary' as const }
        }
      ];
    }
  }

  const cards = getStatCards();

  return (
    <div className="w-full">
      <div 
        className="hidden md:grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      >
        {cards.map((stat, index) => (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            subtitle={stat.subtitle}
            badge={stat.badge}
            // Ваши стили для уменьшения шрифта оставлены, чтобы карточки влезали в один ряд на планшете
            valueClassName="text-xs xs:text-sm font-semibold sm:text-base md:text-lg"
            className="[&_header]:!p-2 [&_header]:sm:!p-3 [&_header]:!pb-1 [&_header]:sm:!pb-1.5 [&_h2]:!text-xs [&_h2]:xs:!text-sm [&_h2]:sm:!text-base [&_h2]:!mb-0 [&_h2]:!leading-tight [&_p]:!text-[10px] [&_p]:xs:!text-xs [&_p]:!mb-0 [&_p]:!leading-tight [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:xs:!h-3.5 [&_svg]:xs:!w-3.5 [&_svg]:sm:!h-4 [&_svg]:sm:!w-4 [&_span]:!text-[10px] [&_span]:xs:!text-xs [&_span]:!px-1 [&_span]:xs:!px-1.5 [&_span]:!py-0 [&_span]:!leading-tight"
          />
        ))}
      </div>
    </div>
  )
}