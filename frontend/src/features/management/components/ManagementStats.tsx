import React from 'react';
import { Card, CardFooter, CardHeader, CardTitle, CardDescription, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Key, Database, FolderOpen, Zap } from 'lucide-react';
import type { ManagementStats as ManagementStatsType } from '@/features/user-administration/hooks/use-management-stats';

interface ManagementStatsProps {
  stats: ManagementStatsType;
  loading?: boolean;
}

export const ManagementStats: React.FC<ManagementStatsProps> = React.memo(({ stats, loading = false }) => {
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
      title: 'License Keys',
      value: stats.totalKeys,
      icon: Key,
      subtitle: stats.totalKeys > 0 ? `${stats.activeKeys} active` : 'No keys yet',
      badge: {
        text: `${stats.activeKeys} active`,
        color: 'primary'
      }
    },
    {
      title: 'Products',
      value: stats.totalProducts,
      icon: Database,
      subtitle: 'Products in database',
      badge: {
        text: 'Products',
        color: 'primary'
      }
    },
    {
      title: 'Files',
      value: stats.totalFiles,
      icon: FolderOpen,
      subtitle: 'Total files in system',
      badge: {
        text: 'Files',
        color: 'primary'
      }
    },
    {
      title: 'Agents',
      value: stats.totalAgents,
      icon: Zap,
      subtitle: 'Total agents available',
      badge: {
        text: 'Agents',
        color: 'primary'
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
                {stat.title === 'License Keys'
                  ? 'License keys in system'
                  : stat.title === 'Products'
                  ? 'Products in database'
                  : stat.title === 'Files'
                  ? 'Total files in system'
                  : 'Total agents available'}
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
});

ManagementStats.displayName = 'ManagementStats';

