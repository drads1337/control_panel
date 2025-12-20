import React from 'react';
import { StatCard } from "@/features/dashboard/stat-card";
import { Activity, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import type { WebhookStats as WebhookStatsType } from './types';

interface WebhookStatsProps {
  stats: WebhookStatsType | null;
  loading?: boolean;
}

const WebhookStats: React.FC<WebhookStatsProps> = React.memo(({ stats, loading = false }) => {
  if (!stats && !loading) return null;

  const statCards = [
    {
      title: 'Total Webhooks',
      value: stats?.total_webhooks || 0,
      icon: Activity,
      subtitle: (stats?.total_webhooks || 0) > 0 ? `${Math.round(((stats?.active_webhooks || 0) / (stats?.total_webhooks || 1)) * 100) || 0}% active` : 'No webhooks yet',
      badge: {
        text: `${stats?.active_webhooks || 0} active`,
        color: 'primary' as const
      }
    },
    {
      title: 'Active',
      value: stats?.active_webhooks || 0,
      icon: CheckCircle,
      subtitle: 'Currently active webhooks',
      badge: {
        text: 'Active',
        color: 'primary' as const
      }
    },
    {
      title: 'Successful',
      value: stats?.total_success || 0,
      icon: TrendingUp,
      subtitle: (stats?.total_success || 0) > 0 ? `${stats?.success_rate || 0}% success rate` : 'No deliveries yet',
      badge: {
        text: `${stats?.success_rate || 0}% rate`,
        color: 'primary' as const
      }
    },
    {
      title: 'Failed',
      value: stats?.total_failures || 0,
      icon: AlertCircle,
      subtitle: (stats?.total_failures || 0) > 0 ? `${stats?.total_failures} failures` : 'No failures',
      badge: {
        text: 'Failures',
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
            value={stat.value}
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

WebhookStats.displayName = 'WebhookStats';

export { WebhookStats };