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
  if (loading) {
    return (
      <div 
        // АДАПТАЦИЯ: grid-cols-2 для мобильных, sm:grid-cols-4 для планшетов+
        className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card hidden md:grid gap-2 grid-cols-2 sm:grid-cols-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      >
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-1.5 sm:pb-0.5">
              <div className="h-2 w-8 bg-muted animate-pulse rounded"></div>
              <div className="h-2 w-2 bg-muted animate-pulse rounded"></div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-1.5 sm:pt-0">
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
      // АДАПТАЦИЯ: 2 колонки на телефоне, 4 на десктопе
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card hidden md:grid gap-2 grid-cols-2 sm:grid-cols-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
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
            // АДАПТАЦИЯ: На мобильном текст значения чуть больше
            valueClassName="text-base sm:text-sm font-semibold"
            // АДАПТАЦИЯ CSS классов:
            // 1. Mobile (default): p-3, icons h-4, text-xs (нормальные отступы)
            // 2. Desktop (sm:): !p-1.5, icons !h-3, !text-xs (ваши оригинальные компактные стили)
            className={`
              [&_header]:p-3 [&_header]:pb-1 sm:[&_header]:!p-1.5 sm:[&_header]:!pb-0.5
              [&_h2]:text-xs sm:[&_h2]:!text-sm [&_h2]:mb-0 sm:[&_h2]:!mb-0
              [&_p]:text-[10px] sm:[&_p]:!text-xs [&_p]:mb-0 sm:[&_p]:!mb-0
              [&_svg]:h-4 [&_svg]:w-4 sm:[&_svg]:!h-3 sm:[&_svg]:!w-3
              [&_span]:text-[10px] sm:[&_span]:!text-xs [&_span]:px-1.5 [&_span]:py-0.5 sm:[&_span]:!px-1 sm:[&_span]:!py-0
            `}
          />
        );
      })}
    </div>
  );
});

WebhookStats.displayName = 'WebhookStats';

export { WebhookStats };