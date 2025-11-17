import React from 'react';
import { StatCard } from '@/app/dashboard/stat-card';
import { Activity, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import type { WebhookStats } from './types';

interface WebhookStatsProps {
  stats: WebhookStats | null;
}

export function WebhookStats({ stats }: WebhookStatsProps) {
  if (!stats) return null;

  return (
    <div 
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-6 mb-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      style={{gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'}}
    >
      <StatCard
        title="Total Webhooks"
        value={stats.total_webhooks || 0}
        icon={Activity}
        badge={{
          text: `${stats.active_webhooks || 0} active`,
          color: 'primary'
        }}
        footer={{
          description: 'Webhook management',
          details: 'Total webhooks',
          icon: Activity
        }}
      />
      <StatCard
        title="Active Webhooks"
        value={stats.active_webhooks || 0}
        icon={CheckCircle}
        badge={{
          text: 'Currently active',
          color: 'primary'
        }}
        footer={{
          description: 'Active webhooks',
          details: 'Webhooks enabled',
          icon: CheckCircle
        }}
      />
      <StatCard
        title="Successful Deliveries"
        value={stats.total_success || 0}
        icon={TrendingUp}
        badge={{
          text: `${stats.success_rate || 0}% success rate`,
          color: 'primary'
        }}
        footer={{
          description: 'Delivery statistics',
          details: 'Successful deliveries',
          icon: TrendingUp
        }}
      />
      <StatCard
        title="Failed Deliveries"
        value={stats.total_failures || 0}
        icon={AlertCircle}
        badge={{
          text: `${stats.total_failures || 0} failures`,
          color: 'primary'
        }}
        footer={{
          description: 'Delivery statistics',
          details: 'Failed deliveries',
          icon: AlertCircle
        }}
      />
    </div>
  );
}
