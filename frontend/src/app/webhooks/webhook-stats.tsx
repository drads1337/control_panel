import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatCard } from '@/app/dashboard/stat-card';
import { Activity, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import type { WebhookStats as WebhookStatsType } from './types';

interface WebhookStatsProps {
  stats: WebhookStatsType | null;
  loading?: boolean;
}

const WebhookStats: React.FC<WebhookStatsProps> = React.memo(({ stats, loading = false }) => {
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

  if (!stats) return null;

  const statCards = [
    {
      title: 'Total Webhooks',
      value: stats.total_webhooks || 0,
      icon: Activity,
      subtitle: stats.total_webhooks > 0 ? `${Math.round(((stats.active_webhooks || 0) / stats.total_webhooks) * 100) || 0}% active` : 'No webhooks yet',
      badge: {
        text: `${stats.active_webhooks || 0} active`,
        color: 'primary'
      }
    },
    {
      title: 'Active',
      value: stats.active_webhooks || 0,
      icon: CheckCircle,
      subtitle: 'Currently active webhooks',
      badge: {
        text: 'Active',
        color: 'primary'
      }
    },
    {
      title: 'Successful',
      value: stats.total_success || 0,
      icon: TrendingUp,
      subtitle: stats.total_success > 0 ? `${stats.success_rate || 0}% success rate` : 'No deliveries yet',
      badge: {
        text: `${stats.success_rate || 0}% rate`,
        color: 'primary'
      }
    },
    {
      title: 'Failed',
      value: stats.total_failures || 0,
      icon: AlertCircle,
      subtitle: stats.total_failures > 0 ? `${stats.total_failures} failures` : 'No failures',
      badge: {
        text: 'Failures',
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

WebhookStats.displayName = 'WebhookStats';

export { WebhookStats };
