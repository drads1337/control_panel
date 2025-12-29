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
import { Skeleton } from '@/components/ui/skeleton';

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
      }
    },
    {
      title: 'Active',
      value: stats.active,
      icon: UserCheck,
      subtitle: 'Currently active users',
      badge: {
        text: 'Active',
      }
    },
    {
      title: 'With Keys',
      value: stats.withKeys,
      icon: Key,
      subtitle: stats.total > 0 && stats.withKeys > 0 ? `${Math.round((stats.withKeys / stats.total) * 100) || 0}% of total` : stats.withKeys === 0 ? 'No license keys' : 'Calculating...',
      badge: {
        text: 'Has keys',
      }
    },
    {
      title: 'Employees',
      value: stats.admins,
      icon: Shield,
      subtitle: 'Staff members & admins',
      badge: {
        text: 'Employees',
      }
    }
  ];

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="@container/card p-3">
            <CardHeader className="p-0 pb-1">
              <CardDescription className="text-xs">{stat.title}</CardDescription>
              {loading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                  {stat.value.toLocaleString()}
                </CardTitle>
              )}
              <CardAction>
                <Badge variant="outline" className="text-xs h-5 px-1.5">
                  <Icon className="size-3" />
                  {stat.badge.text}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
              <div className="line-clamp-1 flex gap-1.5 font-medium">
                {stat.subtitle}
              </div>
              <div className="text-muted-foreground">
                {stat.title === 'Total Users' && 'Active accounts across all projects'}
                {stat.title === 'Active' && 'Users with active sessions'}
                {stat.title === 'With Keys' && 'Users with active license keys'}
                {stat.title === 'Employees' && 'Staff members and administrators'}
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