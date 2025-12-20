import React from 'react';
import { StatCard } from '@/app/dashboard/stat-card';
import { Users, UserCheck, Shield, Key } from 'lucide-react';

interface UsersStatsProps {
  stats: {
    total: number;
    active: number;
    withKeys: number;
    admins: number;
  };
  loading?: boolean;
}

const UsersStats: React.FC<UsersStatsProps> = React.memo(({ stats, loading = false }) => {
  const statCards = [
    {
      title: 'Total Users',
      value: stats.total,
      icon: Users,
      subtitle: stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100) || 0}% active` : 'No users yet',
      badge: {
        text: `${stats.active} active`,
        color: 'primary' as const
      }
    },
    {
      title: 'Active',
      value: stats.active,
      icon: UserCheck,
      subtitle: 'Currently active users',
      badge: {
        text: 'Active',
        color: 'primary' as const
      }
    },
    {
      title: 'With Keys',
      value: stats.withKeys,
      icon: Key,
      subtitle: stats.total > 0 && stats.withKeys > 0 ? `${Math.round((stats.withKeys / stats.total) * 100) || 0}% of total` : stats.withKeys === 0 ? 'No license keys' : 'Calculating...',
      badge: {
        text: 'Has keys',
        color: 'primary' as const
      }
    },
    {
      title: 'Employees',
      value: stats.admins,
      icon: Shield,
      subtitle: 'Staff members & admins',
      badge: {
        text: 'Employees',
        color: 'primary' as const
      }
    }
  ];

  return (
    <div className="w-full">
      <div 
        className="hidden md:grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      >
        {statCards.map((stat, index) => (
          <StatCard
            key={index}
            title={stat.title}
            value={loading ? undefined : stat.value}
            icon={stat.icon}
            subtitle={stat.subtitle}
            badge={stat.badge}
            loading={loading}
            valueClassName="text-xs xs:text-sm font-semibold sm:text-base md:text-lg"
            className="[&_header]:!p-2 [&_header]:sm:!p-3 [&_header]:!pb-1 [&_header]:sm:!pb-1.5 [&_h2]:!text-xs [&_h2]:xs:!text-sm [&_h2]:sm:!text-base [&_h2]:!mb-0 [&_h2]:!leading-tight [&_p]:!text-[10px] [&_p]:xs:!text-xs [&_p]:!mb-0 [&_p]:!leading-tight [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:xs:!h-3.5 [&_svg]:xs:!w-3.5 [&_svg]:sm:!h-4 [&_svg]:sm:!w-4 [&_span]:!text-[10px] [&_span]:xs:!text-xs [&_span]:!px-1 [&_span]:xs:!px-1.5 [&_span]:!py-0 [&_span]:!leading-tight"
          />
        ))}
      </div>
    </div>
  );
});

UsersStats.displayName = 'UsersStats';

export default UsersStats;