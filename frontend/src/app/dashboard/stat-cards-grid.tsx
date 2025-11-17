import { StatCard } from './stat-card'
import { Users, Key, Gamepad2, Server, Activity, Building2, DollarSign, TrendingUp, CheckCircle, Target, Database, FolderOpen } from 'lucide-react'
import { DashboardData } from '@/hooks/use-dashboard-stats'
import { OwnerDashboardStats } from '@/hooks/use-owner-dashboard'
import type { User } from '@/entities/user';
import type { Project } from '@/entities/project';
import type { Game } from '@/entities/game';

interface StatCardsGridProps {
  data?: DashboardData | OwnerDashboardStats | null
  type: 'dashboard' | 'owner'
}

export function StatCardsGrid({ data, type }: StatCardsGridProps) {
  if (!data) return null

  const renderDashboardCards = (data: DashboardData) => (
    <>
      <StatCard
        title="Users"
        value={data.overview.users.total}
        icon={Users}
        badge={{
          text: `${data.overview.users.active} active`,
          color: "primary"
        }}
        footer={{
          description: "User management system",
          details: `${data.overview.users.new_today} new today`,
          icon: Users
        }}
      />
      <StatCard
        title="License Keys"
        value={data.overview.keys.total}
        icon={Key}
        badge={{
          text: `${data.overview.keys.active} active`,
          color: "primary"
        }}
        footer={{
          description: "Key management system",
          details: `${data.overview.keys.expired} expired keys`,
          icon: Key
        }}
      />
      <StatCard
        title="Games"
        value={data.overview.games.total}
        icon={Gamepad2}
        badge={{
          text: `${data.overview.games.active} active`,
          color: "primary"
        }}
        footer={{
          description: "Application catalog management",
          details: "Total applications in the database",
          icon: Database
        }}
      />
      <StatCard
        title="Servers"
        value={data.overview.servers.total}
        icon={Server}
        badge={{
          text: `${data.overview.servers.online} online`,
          color: "primary"
        }}
        footer={{
          description: "Server infrastructure",
          details: `${data.overview.servers.offline} offline servers`,
          icon: Server
        }}
      />
    </>
  )

  const renderOwnerCards = (data: OwnerDashboardStats) => (
    <>
      <StatCard
        title="Projects"
        value={data.system_overview.total_projects}
        icon={Building2}
        badge={{
          text: `${data.system_overview.active_projects} active`,
          color: "primary"
        }}
        footer={{
          description: "Project management system",
          details: "Multi-tenant project infrastructure",
          icon: Building2
        }}
      />
      <StatCard
        title="Total Users"
        value={data.system_overview.total_users}
        icon={Users}
        badge={{
          text: `${data.user_analytics.new_today} new today`,
          color: "primary"
        }}
        footer={{
          description: "User analytics and management",
          details: `${data.system_overview.active_users} active users`,
          icon: Users
        }}
      />
      <StatCard
        title="License Keys"
        value={data.system_overview.total_keys}
        icon={Key}
        badge={{
          text: `${data.system_overview.active_keys} active`,
          color: "primary"
        }}
        footer={{
          description: "Key management system",
          details: "Cross-project key distribution",
          icon: Key
        }}
      />
      <StatCard
        title="Revenue"
        value={`$${data.system_overview.total_revenue.toLocaleString()}`}
        icon={DollarSign}
        badge={{
          text: "All Projects",

          color: "primary"
        }}
        footer={{
          description: "Revenue analytics",
          details: `$${data.system_overview.monthly_revenue.toLocaleString()} this month`,
          icon: DollarSign
        }}
      />
    </>
  )


  const renderCards = () => {
    switch (type) {
      case 'dashboard':
        return renderDashboardCards(data as DashboardData)
      case 'owner':
        return renderOwnerCards(data as OwnerDashboardStats)
      default:
        return null
    }
  }

  return (
    <div 
      className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs"
      style={{gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'}}
    >
      {renderCards()}
    </div>
  )
}
