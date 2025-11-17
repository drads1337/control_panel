import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  if (loading) {
    return (
      <div 
        className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
        style={{gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'}}
      >
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-4 bg-muted animate-pulse rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2"></div>
              <div className="h-3 w-24 bg-muted animate-pulse rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.total,
      icon: Users,
      badge: {
        text: `${stats.active} active`,
        color: 'primary'
      },
      footer: {
        description: 'User management system',
        details: 'All registered users',
        icon: Users
      }
    },
    {
      title: 'Active',
      value: stats.active,
      icon: UserCheck,
      badge: {
        text: 'Currently active',
        color: 'primary'
      },
      footer: {
        description: 'Active users',
        details: 'Users with active status',
        icon: UserCheck
      }
    },
    {
      title: 'With Keys',
      value: stats.withKeys,
      icon: Key,
      badge: {
        text: 'Has keys',
        color: 'primary'
      },
      footer: {
        description: 'License management',
        details: 'Have license keys',
        icon: Key
      }
    },
    {
      title: 'Employees',
      value: stats.admins,
      icon: Shield,
      badge: {
        text: 'Employee users',
        color: 'primary'
      },
      footer: {
        description: 'Employee management',
        details: 'Employee users',
        icon: Shield
      }
    }
  ];

  return (
    <div 
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      style={{gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'}}
    >
      {statCards.map((stat, index) => {
        return (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            badge={stat.badge}
            footer={stat.footer}
          />
        );
      })}
    </div>
  );
});

UsersStats.displayName = 'UsersStats';

export default UsersStats;
