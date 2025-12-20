import React from 'react';
import { StatsCard, type StatsData } from '@/components/ui/stats-card';
import type { ManagementStats } from '@/features/user-administration/hooks/use-management-stats';

interface ManagementStatsProps {
  stats: ManagementStats;
  loading?: boolean;
}

const ManagementStats: React.FC<ManagementStatsProps> = React.memo(({ stats, loading = false }) => {
  if (loading) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface-dark border border-border-dark rounded p-4 h-24 animate-pulse">
              <div className="h-3 w-20 bg-border-dark rounded mb-2"></div>
              <div className="h-6 w-12 bg-border-dark rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statsData: StatsData[] = [
    { 
      id: '1', 
      label: 'License Keys', 
      subLabel: 'Active', 
      value: String(stats.totalKeys), 
      subValue: String(stats.activeKeys), 
      subValueLabel: 'ACTIVE KEYS', 
      icon: 'vpn_key', 
      active: true 
    },
    { 
      id: '2', 
      label: 'Products', 
      subLabel: 'DB', 
      value: String(stats.totalProducts), 
      subValue: '', 
      subValueLabel: 'GLOBAL ITEMS', 
      icon: 'inventory_2' 
    },
    { 
      id: '3', 
      label: 'Files', 
      subLabel: 'SYS', 
      value: String(stats.totalFiles), 
      subValue: '', 
      subValueLabel: 'SYSTEM FILES', 
      icon: 'folder' 
    },
    { 
      id: '4', 
      label: 'Agents', 
      subLabel: 'NET', 
      value: String(stats.totalAgents), 
      subValue: '', 
      subValueLabel: 'ONLINE NODES', 
      icon: 'bolt' 
    },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {statsData.map(data => (
          <StatsCard key={data.id} data={data} />
        ))}
      </div>
    </div>
  );
});

ManagementStats.displayName = 'ManagementStats';

export default ManagementStats;