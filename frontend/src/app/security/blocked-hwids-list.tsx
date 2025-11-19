import React, { useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { 
  Search, 
  Monitor, 
  Unlock,
  Eye,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import AddHWIDBlock from './add-hwid-block'

interface BlockedHWID {
  id: number
  hwid: string
  reason: string
  blocked_at: string
  expires_at?: string
  is_active: boolean
  block_type: string
  category: string
  severity: string
  threat_score: number
  cpu_info?: string
  gpu_info?: string
  motherboard_info?: string
  ram_info?: string
  attempt_count: number
  blocked_by?: string
  unblocked_at?: string
  unblocked_by?: string
}

interface BlockedHWIDsListProps {
  blockedHWIDs: BlockedHWID[]
  loading: boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
  onUnblockHWID: (hwidId: number) => void
  onViewDetails: (hwid: BlockedHWID) => void
  onBlockHWID: (data: {
    hwid: string
    reason: string
    expires_at?: string
    block_type: string
    category: string
    severity: string
    threat_score: number
  }) => void
  onRefresh?: () => void
}

const HWIDItem = React.memo(({ 
  hwid, 
  loading, 
  onUnblock,
  onViewDetails,
  canUnblock,
  getSeverityColor,
  getCategoryColor
}: { 
  hwid: BlockedHWID;
  loading: boolean;
  onUnblock: (hwidId: number) => void;
  onViewDetails: (hwid: BlockedHWID) => void;
  canUnblock: boolean;
  getSeverityColor: (severity: string) => string;
  getCategoryColor: (category: string) => string;
}) => {
  return (
    <div className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Monitor className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium font-mono text-xs">
              {hwid.hwid}
            </h4>
            <Badge className={getCategoryColor(hwid.category)} variant="secondary">
              {hwid.category}
            </Badge>
            <Badge className={getSeverityColor(hwid.severity)} variant="secondary">
              {hwid.severity}
            </Badge>
            {!hwid.is_active && (
              <span className="text-xs text-muted-foreground">• Inactive</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground truncate">
              {hwid.reason}
            </p>
            <span className="text-xs text-muted-foreground">
              • {new Date(hwid.blocked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={() => onViewDetails(hwid)}
          disabled={loading}
        >
          <Eye className="h-4 w-4" />
        </Button>
        {hwid.is_active && canUnblock && (
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onUnblock(hwid.id)}
            disabled={loading}
          >
            <Unlock className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});

HWIDItem.displayName = 'HWIDItem';

interface HWIDsListProps {
  hwids: BlockedHWID[];
  loading: boolean;
  onUnblock: (hwidId: number) => void;
  onViewDetails: (hwid: BlockedHWID) => void;
  canUnblock: boolean;
  getSeverityColor: (severity: string) => string;
  getCategoryColor: (category: string) => string;
}

const HWIDsList: React.FC<HWIDsListProps> = ({
  hwids,
  loading,
  onUnblock,
  onViewDetails,
  canUnblock,
  getSeverityColor,
  getCategoryColor
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = hwids.length > 50;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? hwids.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  if (shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px', contain: 'strict' }}
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
              const hwid = hwids[virtualRow.index];
              return (
                <div
                  key={hwid.id}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <HWIDItem
                    hwid={hwid}
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
      {hwids.map((hwid) => (
        <HWIDItem
          key={hwid.id}
          hwid={hwid}
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

export default function BlockedHWIDsList({
  blockedHWIDs,
  loading,
  searchTerm,
  setSearchTerm,
  onUnblockHWID,
  onViewDetails,
  onBlockHWID,
  onRefresh
}: BlockedHWIDsListProps) {
  const { canViewHWIDs, canBlockHWIDs, canUnblockHWIDs } = useSecurityPermissions();
  
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

  const filteredHWIDs = useMemo(() => {
    return (blockedHWIDs || []).filter(hwid =>
      hwid.hwid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hwid.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hwid.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hwid.severity.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [blockedHWIDs, searchTerm]);

  if (!canViewHWIDs) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Blocked Hardware IDs</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {blockedHWIDs?.length || 0} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={onRefresh}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search HWIDs, reasons, categories..."
                  className="pl-10 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <ConditionalRender permission="security.block_hwids" fallback={null}>
                <AddHWIDBlock onAdd={onBlockHWID} loading={loading} />
              </ConditionalRender>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 -mt-3">
          {loading ? (
            <Spinner message="Loading blocked HWIDs..." />
          ) : filteredHWIDs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Monitor className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">
                  {searchTerm ? 'No HWIDs match your search criteria' : 'No hardware IDs are currently blocked'}
                </div>
              </div>
            </div>
          ) : (
            <HWIDsList
              hwids={filteredHWIDs}
              loading={loading}
              onUnblock={onUnblockHWID}
              onViewDetails={onViewDetails}
              canUnblock={canUnblockHWIDs}
              getSeverityColor={getSeverityColor}
              getCategoryColor={getCategoryColor}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
