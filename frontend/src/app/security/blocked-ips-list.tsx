import React, { useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { 
  Search, 
  Globe, 
  MapPin, 
  Unlock,
  Eye,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import AddIPBlock from './add-ip-block'

interface BlockedIP {
  id: number
  ip_address: string
  reason: string
  blocked_at: string
  expires_at?: string
  is_active: boolean
  block_type: string
  category: string
  severity: string
  threat_score: number
  country?: string
  city?: string
  attempt_count: number
  blocked_by?: string
  unblocked_at?: string
  unblocked_by?: string
}

interface BlockedIPsListProps {
  blockedIPs: BlockedIP[]
  loading: boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
  onUnblockIP: (ipId: number) => void
  onViewDetails: (ip: BlockedIP) => void
  onBlockIP: (data: {
    ip_address: string
    reason: string
    expires_at?: string
    block_type: string
    category: string
    severity: string
    threat_score: number
  }) => void
  onRefresh?: () => void
}

const IPItem = React.memo(({ 
  ip, 
  loading, 
  onUnblock,
  onViewDetails,
  canUnblock,
  getSeverityColor,
  getCategoryColor
}: { 
  ip: BlockedIP;
  loading: boolean;
  onUnblock: (ipId: number) => void;
  onViewDetails: (ip: BlockedIP) => void;
  canUnblock: boolean;
  getSeverityColor: (severity: string) => string;
  getCategoryColor: (category: string) => string;
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 p-3 sm:p-2.5 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Globe className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-0">
            <h4 className="font-medium text-xs sm:text-sm font-sans break-all sm:truncate">
              {ip.ip_address}
            </h4>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Badge className={`${getCategoryColor(ip.category)} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5`} variant="secondary">
                {ip.category}
              </Badge>
              <Badge className={`${getSeverityColor(ip.severity)} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5`} variant="secondary">
                {ip.severity}
              </Badge>
              {!ip.is_active && (
                <span className="text-[10px] sm:text-xs text-muted-foreground">• Inactive</span>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <p className="text-xs text-muted-foreground break-words sm:truncate sm:max-w-md">
              {ip.reason}
            </p>
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              {ip.city && ip.country && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  • <MapPin className="h-3 w-3 inline" /> {ip.city}, {ip.country}
                </span>
              )}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                • {new Date(ip.blocked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-1 shrink-0 self-end sm:self-auto">
        <Button 
          variant="ghost" 
          size="icon"
          className="h-9 w-9 sm:h-8 sm:w-8"
          onClick={() => onViewDetails(ip)}
          disabled={loading}
        >
          <Eye className="h-4 w-4" />
        </Button>
        {ip.is_active && canUnblock && (
          <Button 
            variant="ghost" 
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
            onClick={() => onUnblock(ip.id)}
            disabled={loading}
          >
            <Unlock className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});

IPItem.displayName = 'IPItem';

interface IPsListProps {
  ips: BlockedIP[];
  loading: boolean;
  onUnblock: (ipId: number) => void;
  onViewDetails: (ip: BlockedIP) => void;
  canUnblock: boolean;
  getSeverityColor: (severity: string) => string;
  getCategoryColor: (category: string) => string;
}

const IPsList: React.FC<IPsListProps> = ({
  ips,
  loading,
  onUnblock,
  onViewDetails,
  canUnblock,
  getSeverityColor,
  getCategoryColor
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = ips.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? ips.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  if (shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: 'calc(100vh - 280px)', maxHeight: '600px', contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <div className="divide-y">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const ip = ips[virtualRow.index];
              return (
                <div
                  key={ip.id}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <IPItem
                    ip={ip}
                    loading={loading}
                    onUnblock={onUnblock}
                    onViewDetails={onViewDetails}
                    canUnblock={canUnblock}
                    getSeverityColor={getSeverityColor}
                    getCategoryColor={getCategoryColor}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {ips.map((ip) => (
        <IPItem
          key={ip.id}
          ip={ip}
          loading={loading}
          onUnblock={onUnblock}
          onViewDetails={onViewDetails}
          canUnblock={canUnblock}
          getSeverityColor={getSeverityColor}
          getCategoryColor={getCategoryColor}
        />
      ))}
    </div>
  );
};

export default function BlockedIPsList({
  blockedIPs,
  loading,
  searchTerm,
  setSearchTerm,
  onUnblockIP,
  onViewDetails,
  onBlockIP,
  onRefresh
}: BlockedIPsListProps) {
  const { canViewIPs, canBlockIPs, canUnblockIPs } = useSecurityPermissions();
  
  const getSeverityColor = useCallback((severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }, []);

  const getCategoryColor = useCallback((category: string) => {
    switch (category.toLowerCase()) {
      case 'spam': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'abuse': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'fraud': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'malware': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'suspicious': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'violation': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'rate_limit': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
      case 'geo_block': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }, []);

  const filteredIPs = useMemo(() => {
    return (blockedIPs || []).filter(ip =>
      ip.ip_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ip.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ip.country && ip.country.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ip.city && ip.city.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [blockedIPs, searchTerm]);

  if (!canViewIPs) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg">Blocked IP Addresses</CardTitle>
              <CardDescription className="mt-1 text-xs sm:text-sm">
                {blockedIPs?.length || 0} total
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {onRefresh && (
                 <Button 
                 variant="ghost" 
                 size="sm"
                 onClick={onRefresh}
                 disabled={loading}
                 className="justify-center h-9 sm:h-8"
               >
                 {loading ? (
                   <Spinner className="h-4 w-4 animate-spin" />
                 ) : (
                   'Refresh'
                 )}
               </Button>
              )}

              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-10 w-full sm:w-64 h-9 sm:h-8 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <ConditionalRender permission="security.block_ips" fallback={null}>
                <AddIPBlock onAdd={onBlockIP} loading={loading} />
              </ConditionalRender>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 pb-4 sm:pb-6">
          {loading ? (
            <Spinner message="Loading blocked IPs..." />
          ) : filteredIPs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">
                  {searchTerm ? 'No IPs match your search criteria' : 'No IP addresses are currently blocked'}
                </div>
              </div>
            </div>
          ) : (
            <IPsList
              ips={filteredIPs}
              loading={loading}
              onUnblock={onUnblockIP}
              onViewDetails={onViewDetails}
              canUnblock={canUnblockIPs}
              getSeverityColor={getSeverityColor}
              getCategoryColor={getCategoryColor}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}