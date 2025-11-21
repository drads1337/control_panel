import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatCard } from '@/app/dashboard/stat-card';
import { Key, Database, FolderOpen, Zap } from 'lucide-react';
import type { ManagementStats } from '@/hooks/use-management-stats';

interface ManagementStatsProps {
  stats: ManagementStats;
  loading?: boolean;
}

const ManagementStats: React.FC<ManagementStatsProps> = React.memo(({ stats, loading = false }) => {
  // Уменьшаем размер сетки до 120px для компактности
  const gridStyle = { gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' };

  if (loading) {
    return (
      <div 
        className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-2 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
        style={gridStyle}
      >
        {[...Array(4)].map((_, i) => (
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
    <div 
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-2 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      style={gridStyle}
    >
      {statCards.map((stat, index) => {
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
        );
      })}
    </div>
  );
});

ManagementStats.displayName = 'ManagementStats';

export default ManagementStats;

