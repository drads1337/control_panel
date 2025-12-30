import React from 'react';
import { Users, UserCheck, Shield, Key } from 'lucide-react';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  // Shared grid styling from ManagementStats
  const gridContainerClass = "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 md:grid-cols-4 gap-3 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6";

  if (loading) {
    return (
      <div className={gridContainerClass}>
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="@container/card p-3">
            <CardHeader className="p-0 pb-1">
              <div className="h-3 w-20 bg-muted animate-pulse rounded"></div>
              <div className="h-6 w-16 bg-muted animate-pulse rounded mt-2"></div>
              <div className="h-5 w-16 bg-muted animate-pulse rounded mt-2"></div>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
              <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
              <div className="h-3 w-24 bg-muted animate-pulse rounded"></div>
            </CardFooter>
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
      subtitle: stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100) || 0}% active` : 'No users yet',
      description: 'Active accounts across project',
      badge: {
        text: `${stats.active} active`,
      }
    },
    {
      title: 'Active',
      value: stats.active,
      icon: UserCheck,
      subtitle: 'Currently active users',
      description: 'Users with active sessions',
      badge: {
        text: 'Active',
      }
    },
    {
      title: 'With Keys',
      value: stats.withKeys,
      icon: Key,
      subtitle: stats.total > 0 && stats.withKeys > 0 ? `${Math.round((stats.withKeys / stats.total) * 100) || 0}% of total` : stats.withKeys === 0 ? 'No license keys' : 'Calculating...',
      description: 'Users with active license keys',
      badge: {
        text: 'Has keys',
      }
    },
    {
      title: 'Employees',
      value: stats.admins,
      icon: Shield,
      subtitle: 'Staff members & admins',
      description: 'Staff members and administrators',
      badge: {
        text: 'Employees',
      }
    }
  ];

  return (
    <div className={gridContainerClass}>
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="@container/card p-3">
            <CardHeader className="p-0 pb-1">
              <CardDescription className="text-xs">{stat.title}</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                {stat.value.toLocaleString()}
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
        );
      })}
    </div>
  );
});

UsersStats.displayName = 'UsersStats';

export default UsersStats;