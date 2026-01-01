import React from 'react';
import { Activity, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WebhookStats as WebhookStatsType } from '../types';

interface WebhookStatsProps {
  stats: WebhookStatsType | null;
  loading?: boolean;
}

const WebhookStats: React.FC<WebhookStatsProps> = React.memo(({ stats, loading = false }) => {
  // Shared grid styling from UsersStats
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

  if (!stats) return null;

  const statCards = [
    {
      title: 'Total Webhooks',
      value: stats.total_webhooks || 0,
      icon: Activity,
      subtitle: (stats.total_webhooks || 0) > 0 ? `${Math.round(((stats.active_webhooks || 0) / (stats.total_webhooks || 1)) * 100) || 0}% active` : 'No webhooks yet',
      description: 'Webhooks across project',
      badge: {
        text: `${stats.active_webhooks || 0} active`,
      }
    },
    {
      title: 'Active',
      value: stats.active_webhooks || 0,
      icon: CheckCircle,
      subtitle: 'Currently active webhooks',
      description: 'Webhooks currently enabled',
      badge: {
        text: 'Active',
      }
    },
    {
      title: 'Successful',
      value: stats.total_success || 0,
      icon: TrendingUp,
      subtitle: (stats.total_success || 0) > 0 ? `${stats.success_rate || 0}% success rate` : 'No deliveries yet',
      description: 'Successful webhook deliveries',
      badge: {
        text: `${stats.success_rate || 0}% rate`,
      }
    },
    {
      title: 'Failed',
      value: stats.total_failures || 0,
      icon: AlertCircle,
      subtitle: (stats.total_failures || 0) > 0 ? `${stats.total_failures} failures` : 'No failures',
      description: 'Failed webhook deliveries',
      badge: {
        text: 'Failures',
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

WebhookStats.displayName = 'WebhookStats';

export { WebhookStats };

