import React from 'react';
import { Card, CardFooter, CardHeader, CardTitle, CardDescription, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Webhook, Activity, CheckCircle2, XCircle } from 'lucide-react';
import type { WebhookData } from '../types';

interface WebhookStatsProps {
  webhooks: WebhookData[];
  loading?: boolean;
}

export const WebhookStats: React.FC<WebhookStatsProps> = React.memo(({ webhooks, loading = false }) => {
  const gridContainerClass = "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 md:grid-cols-4 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs";

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

  const totalWebhooks = webhooks.length;
  const activeWebhooks = webhooks.filter(w => w.is_active).length;
  const totalRequests = webhooks.reduce((sum, w) => sum + w.success_count + w.failure_count, 0);
  const totalSuccess = webhooks.reduce((sum, w) => sum + w.success_count, 0);
  const totalFailures = webhooks.reduce((sum, w) => sum + w.failure_count, 0);
  const successRate = totalRequests > 0 ? Math.round((totalSuccess / totalRequests) * 100) : 0;

  const statCards = [
    {
      title: 'Total Webhooks',
      value: totalWebhooks,
      icon: Webhook,
      subtitle: totalWebhooks > 0 ? `${activeWebhooks} active` : 'No webhooks yet',
      badge: {
        text: `${activeWebhooks} active`,
        color: 'primary'
      },
      description: 'Total webhook endpoints configured'
    },
    {
      title: 'Success Rate',
      value: `${successRate}%`,
      icon: CheckCircle2,
      subtitle: totalRequests > 0 ? `${totalSuccess} successful` : 'No requests yet',
      badge: {
        text: successRate >= 95 ? 'Excellent' : successRate >= 80 ? 'Good' : 'Needs attention',
        color: 'primary'
      },
      description: 'Overall webhook delivery success rate'
    },
    {
      title: 'Total Requests',
      value: totalRequests.toLocaleString(),
      icon: Activity,
      subtitle: totalRequests > 0 ? `${totalSuccess} successful, ${totalFailures} failed` : 'No activity yet',
      badge: {
        text: 'Requests',
        color: 'primary'
      },
      description: 'Total webhook delivery attempts'
    },
    {
      title: 'Failed Deliveries',
      value: totalFailures,
      icon: XCircle,
      subtitle: totalFailures > 0 ? `${Math.round((totalFailures / totalRequests) * 100)}% failure rate` : 'No failures',
      badge: {
        text: totalFailures > 0 ? 'Issues' : 'All good',
        color: 'primary'
      },
      description: 'Total failed webhook deliveries'
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

