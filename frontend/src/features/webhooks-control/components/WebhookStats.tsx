import React from 'react';
import { Card, CardFooter, CardHeader, CardTitle, CardDescription, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import type { WebhookStats as WebhookStatsType } from '../types';

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
          <Card key={index} className="@container/card p-3">
            <CardHeader className="p-0 pb-1">
              <CardDescription className="text-xs">{stat.title}</CardDescription>
              <CardTitle className="text-xs xs:text-sm font-semibold sm:text-base md:text-lg tabular-nums @[250px]/card:text-2xl">
                {loading ? (
                  <span className="inline-block h-4 w-8 bg-muted animate-pulse rounded"></span>
                ) : (
                  stat.value
                )}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="text-xs h-5 px-1.5">
                  <stat.icon className="size-3" />
                  {stat.badge.text}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
              <div className="line-clamp-1 flex gap-1.5 font-medium">
                {stat.subtitle}{" "}
                <stat.icon className="size-3" />
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
});

WebhookStats.displayName = 'WebhookStats';

export { WebhookStats };

