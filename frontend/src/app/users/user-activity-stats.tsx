import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  Activity, 
  Clock, 
  TrendingUp,
  Calendar,
  Globe,
  RefreshCw,
  Shield,
  Zap
} from 'lucide-react';

interface UserActivityStatsProps {
  className?: string;
  stats?: {
    total_activities: number;
    today_activities: number;
    week_activities: number;
    month_activities: number;
    unique_ips: number;
    unique_locations: number;
    last_activity: string | null;
  };
  loading?: boolean;
  onRefresh?: () => void;
}

export function UserActivityStats({ 
  className, 
  stats, 
  loading = false, 
  onRefresh
}: UserActivityStatsProps) {

  // Date formatter logic
  const formatLastActivity = (dateString: string | null) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      day: 'numeric', 
      month: 'short'
    });
  };

  // Loading Skeleton
  if (!stats && loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-4">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse mt-2" />
        </CardHeader>
        <CardContent>
          <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-5 w-5 text-primary" />
              Activity Overview
            </CardTitle>
            <CardDescription>
              Summary of your account actions and sessions
            </CardDescription>
          </div>
          {onRefresh && (
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={onRefresh} 
              disabled={loading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Main Stats Grid */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Activities */}
          <div className="p-4 rounded-xl border bg-card hover:bg-accent/40 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Events</span>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.total_activities.toLocaleString()}</div>
          </div>

          {/* Today */}
          <div className="p-4 rounded-xl border bg-card hover:bg-accent/40 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Today</span>
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.today_activities.toLocaleString()}</div>
          </div>

          {/* Unique IPs */}
          <div className="p-4 rounded-xl border bg-card hover:bg-accent/40 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Unique IPs</span>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.unique_ips}</div>
          </div>

          {/* Locations */}
          <div className="p-4 rounded-xl border bg-card hover:bg-accent/40 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Locations</span>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Globe className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.unique_locations}</div>
          </div>
        </div>

        <Separator />

        {/* Secondary Stats Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Last active: <span className="font-medium text-foreground">{formatLastActivity(stats.last_activity)}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              This week: <span className="font-medium text-foreground">{stats.week_activities}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground sm:justify-end">
            <Calendar className="h-4 w-4" />
            <span>
              This month: <span className="font-medium text-foreground">{stats.month_activities}</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}