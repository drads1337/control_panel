import React, { useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { RefreshCw, Cpu } from 'lucide-react'
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import AddHWIDBlock from './AddHWIDBlock'

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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 p-3 sm:p-2.5 border-b hover:bg-muted/50 transition-colors">
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-muted/30 border border-muted-foreground/20 flex items-center justify-center shrink-0">
          <span className="text-xs text-foreground">HW</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-0">
            <h4 className="font-medium font-sans text-xs sm:text-xs break-all sm:truncate sm:max-w-none">
              {hwid.hwid}
            </h4>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Badge className={`${getCategoryColor(hwid.category)} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5`} variant="outline">
                {hwid.category}
              </Badge>
              <Badge className={`${getSeverityColor(hwid.severity)} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5`} variant="outline">
                {hwid.severity}
              </Badge>
              {!hwid.is_active && (
                <span className="text-[10px] sm:text-xs text-muted-foreground">• Inactive</span>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <p className="text-xs text-muted-foreground break-words sm:truncate sm:max-w-md">
              {hwid.reason}
            </p>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              • {new Date(hwid.blocked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-1 shrink-0 self-end sm:self-auto">
        <Button 
          variant="ghost" 
          size="sm"
          className="h-9 sm:h-8 px-3 sm:px-2 text-xs"
          onClick={() => onViewDetails(hwid)}
          disabled={loading}
        >
          View
        </Button>
        {hwid.is_active && canUnblock && (
          <Button 
            variant="ghost" 
            size="sm"
            className="h-9 sm:h-8 text-destructive hover:text-destructive px-3 sm:px-2 text-base sm:text-lg"
            onClick={() => onUnblock(hwid.id)}
            disabled={loading}
          >
            ×
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
  const shouldVirtualize = hwids.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? hwids.length : 0,
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
  const { canViewHWIDs, canUnblockHWIDs } = useSecurityPermissions();
  
  const getSeverityColor = useCallback((severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'medium': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'high': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'critical': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      default: return 'bg-muted/30 text-foreground border border-muted-foreground/20'
    }
  }, []);

  const getCategoryColor = useCallback((category: string) => {
    switch (category.toLowerCase()) {
      case 'spam': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'abuse': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'fraud': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'malware': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'suspicious': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'violation': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'rate_limit': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'geo_block': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      default: return 'bg-muted/30 text-foreground border border-muted-foreground/20'
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
      <Card className="p-3 border rounded-lg bg-background shadow-sm">
        <CardHeader className="p-0 mb-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Blocked Hardware IDs</CardTitle>
              <CardDescription className="text-xs">
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
                  className="h-7 w-7 hover:bg-muted/50"
                >
                  {loading ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                </Button>
              )}
              <Input
                placeholder="Search..."
                className="w-full sm:w-64 h-9 sm:h-8 text-sm bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <AddHWIDBlock onAdd={onBlockHWID} loading={loading} />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 pt-0 -mt-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner message="Loading blocked hardware IDs..." />
            </div>
          ) : filteredHWIDs.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
                <Cpu className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">
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

