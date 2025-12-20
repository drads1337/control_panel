import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatCard } from "@/features/dashboard/stat-card";
import { Key, Database, FolderOpen, Zap } from 'lucide-react';
import type { ManagementStats } from '@/features/user-administration/hooks/use-management-stats';

interface ManagementStatsProps {
  stats: ManagementStats;
  loading?: boolean;
}

const ManagementStats: React.FC<ManagementStatsProps> = React.memo(({ stats, loading = false }) => {
  // Общие классы для грида и стилизации карточек
  const gridContainerClass = "hidden md:grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs";

  if (loading) {
    return (
      <div className="w-full">
        <div className={gridContainerClass}>
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 xs:p-2.5 sm:p-3 md:p-4 lg:p-6 pb-1 xs:pb-1.5">
                <div className="h-2 xs:h-2.5 w-8 xs:w-10 bg-muted animate-pulse rounded"></div>
                <div className="h-2 xs:h-2.5 w-2 xs:w-2.5 bg-muted animate-pulse rounded"></div>
              </CardHeader>
              <CardContent className="p-2 xs:p-2.5 sm:p-3 md:p-4 lg:p-6 pt-0">
                <div className="h-3.5 xs:h-4 sm:h-5 w-6 xs:w-8 sm:w-10 bg-muted animate-pulse rounded mb-0.5 xs:mb-1"></div>
                <div className="h-1.5 xs:h-2 w-10 xs:w-12 sm:w-16 bg-muted animate-pulse rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
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
    <div className="w-full">
      <div className={gridContainerClass}>
        {statCards.map((stat, index) => {
          return (
            <StatCard
              key={index}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              subtitle={stat.subtitle}
              badge={stat.badge}
              valueClassName="text-xs xs:text-sm font-semibold sm:text-base md:text-lg"
              className="[&_header]:!p-2 [&_header]:xs:!p-2.5 [&_header]:sm:!p-3 [&_header]:!pb-1 [&_header]:xs:!pb-1.5 [&_h2]:!text-xs [&_h2]:xs:!text-sm [&_h2]:sm:!text-base [&_h2]:!mb-0 [&_h2]:!leading-tight [&_p]:!text-[10px] [&_p]:xs:!text-xs [&_p]:!mb-0 [&_p]:!leading-tight [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:xs:!h-3.5 [&_svg]:xs:!w-3.5 [&_svg]:sm:!h-4 [&_svg]:sm:!w-4 [&_span]:!text-[10px] [&_span]:xs:!text-xs [&_span]:!px-1 [&_span]:xs:!px-1.5 [&_span]:!py-0 [&_span]:!leading-tight"
            />
          );
        })}
      </div>
    </div>
  );
});

ManagementStats.displayName = 'ManagementStats';

export default ManagementStats;