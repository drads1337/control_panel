import React, { useRef, useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ConditionalRender } from '@/lib/rbac/conditional-render';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination-ui';
import type { StatusType } from '@/lib/status-utils';
import { Package } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LicenseKey } from '@/entities/key';
import { KEY_STATUS } from '@/constants';
import { KeyRow } from './components/KeyRow';

interface LicenseKeysListProps {
  keys: LicenseKey[];
  loading: boolean;
  showKey: Record<number, boolean>;
  fullKeys: Record<number, string>;
  selectedKeys: Set<number>;
  actionLoading: Set<number>;
  pagination: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };
  onToggleKeyVisibility: (keyId: number) => void;
  onSelectKey: (keyId: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onKeyAction: (action: string, keyId: number) => void;
  onViewDetails: (key: LicenseKey) => void;
  onPageChange: (page: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canReset?: boolean;
  canPauseResume?: boolean;
  canExtend?: boolean;
  canBlock?: boolean;
  canGenerate?: boolean;
  canManage?: boolean;
  canViewAll?: boolean;
  viewMode?: 'my' | 'all';
  onViewModeChange?: (mode: 'my' | 'all') => void;
  currentUserId?: number;
}

const LicenseKeysList: React.FC<LicenseKeysListProps> = React.memo(({
  keys,
  loading,
  showKey,
  fullKeys,
  selectedKeys,
  actionLoading,
  pagination,
  onToggleKeyVisibility,
  onSelectKey,
  onSelectAll,
  onKeyAction,
  onViewDetails,
  onPageChange,
  canEdit = false,
  canDelete = false,
  canReset = false,
  canPauseResume = false,
  canExtend = false,
  canBlock = false,
  canGenerate = false,
  canManage = false,
  canViewAll = false,
  viewMode = 'my',
  onViewModeChange,
  currentUserId
}) => {
  const allSelected = React.useMemo(
    () => keys.length > 0 && keys.every(key => selectedKeys.has(key.id)),
    [keys, selectedKeys]
  );
  const someSelected = React.useMemo(
    () => keys.some(key => selectedKeys.has(key.id)),
    [keys, selectedKeys]
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const shouldVirtualize = keys.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? keys.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  const handlePageChange = (page: number) => {
    scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
    onPageChange(page);
  };

  useLayoutEffect(() => {
    if (!loading && scrollPositionRef.current > 0) {
      window.scrollTo({
        top: scrollPositionRef.current,
        behavior: 'instant' as ScrollBehavior,
      });
      scrollPositionRef.current = 0;
    }
  }, [loading, pagination.page]);

  const isOwnKey = React.useCallback((key: LicenseKey) => {
    return key.user_id === currentUserId;
  }, [currentUserId]);

  const canPerformAction = React.useCallback((key: LicenseKey, actionPermission: boolean) => {
    if (!actionPermission) return false;
    if (isOwnKey(key)) return true;
    return canManage;
  }, [isOwnKey, canManage]);

  const getStatusType = React.useCallback((status: number, is_expired?: boolean): StatusType => {
    if (status === KEY_STATUS.BLOCKED) return 'blocked';
    if (status === KEY_STATUS.ACTIVE && is_expired) return 'expired';
    switch (status) {
      case KEY_STATUS.BLOCKED: return 'blocked';
      case KEY_STATUS.ACTIVE: return 'active';
      case KEY_STATUS.EXPIRED: return 'expired';
      case KEY_STATUS.PAUSED: return 'inactive';
      default: return 'inactive';
    }
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading keys...</p>
        </div>
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center mb-6">
          <Package className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No License Keys Found</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Create your first license key to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConditionalRender permission="keys.view" fallback={null}>
        <div className="flex justify-end">
          <Tabs value={viewMode} onValueChange={(value) => onViewModeChange?.(value as 'my' | 'all')}>
            <TabsList>
              <TabsTrigger value="my">My Keys</TabsTrigger>
              <TabsTrigger value="all">All Keys</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </ConditionalRender>

      {/* Обертка для горизонтального скролла на мобильных */}
      <div className="rounded-md border overflow-x-auto relative">
        <div className="min-w-[1000px]">
          <Table style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onSelectAll}
                    ref={(el) => {
                      if (el && 'indeterminate' in el) (el as any).indeterminate = someSelected && !allSelected;
                    }}
                  />
                </TableHead>
                <TableHead className="text-left">Licenses</TableHead>
                <TableHead className="text-left">Product</TableHead>
                <TableHead className="text-left">Target Type</TableHead>
                <TableHead className="text-left">Status</TableHead>
                <TableHead className="text-left">Time</TableHead>
                <TableHead className="text-left">Devices</TableHead>
                <TableHead className="text-left">Created By</TableHead>
                <TableHead className="w-auto text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
          </Table>

          {shouldVirtualize ? (
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
                <Table style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '18%' }} />
                  </colgroup>
                  <TableBody>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const key = keys[virtualRow.index];
                      return (
                        <KeyRow
                          key={key.id}
                          data-index={virtualRow.index}
                          keyData={key}
                          isSelected={selectedKeys.has(key.id)}
                          isKeyVisible={showKey[key.id] || false}
                          fullKey={fullKeys[key.id]}
                          isLoading={actionLoading.has(key.id)}
                          onToggleKeyVisibility={onToggleKeyVisibility}
                          onSelectKey={onSelectKey}
                          onKeyAction={onKeyAction}
                          onViewDetails={onViewDetails}
                          canPerformAction={canPerformAction}
                          getStatusType={(status: number) => getStatusType(status, key.is_expired)}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canReset={canReset}
                          canPauseResume={canPauseResume}
                          canExtend={canExtend}
                          canBlock={canBlock}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <Table style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <TableBody>
                {keys.map((key) => (
                  <KeyRow
                    key={key.id}
                    keyData={key}
                    isSelected={selectedKeys.has(key.id)}
                    isKeyVisible={showKey[key.id] || false}
                    fullKey={fullKeys[key.id]}
                    isLoading={actionLoading.has(key.id)}
                    onToggleKeyVisibility={onToggleKeyVisibility}
                    onSelectKey={onSelectKey}
                    onKeyAction={onKeyAction}
                    onViewDetails={onViewDetails}
                    canPerformAction={canPerformAction}
                    getStatusType={(status: number) => getStatusType(status, key.is_expired)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canReset={canReset}
                    canPauseResume={canPauseResume}
                    canExtend={canExtend}
                    canBlock={canBlock}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {pagination.pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
          <div className="text-sm text-muted-foreground whitespace-nowrap order-2 sm:order-1">
            Showing {((pagination.page - 1) * pagination.perPage) + 1} to {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total} keys
          </div>
          <div className="order-1 sm:order-2 w-full sm:w-auto flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (pagination.page > 1) handlePageChange(pagination.page - 1);
                    }}
                    className={pagination.page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>

                {/* Скрываем номера страниц на очень маленьких экранах, оставляя только стрелки, или показываем меньше */}
                <div className="hidden xs:flex">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.pages <= 5) pageNum = i + 1;
                    else if (pagination.page <= 3) pageNum = i + 1;
                    else if (pagination.page >= pagination.pages - 2) pageNum = pagination.pages - 4 + i;
                    else pageNum = pagination.page - 2 + i;

                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(pageNum);
                          }}
                          isActive={pagination.page === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                </div>

                {pagination.pages > 5 && pagination.page < pagination.pages - 2 && (
                  <PaginationItem className="hidden xs:block">
                    <PaginationEllipsis />
                  </PaginationItem>
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (pagination.page < pagination.pages) handlePageChange(pagination.page + 1);
                    }}
                    className={pagination.page >= pagination.pages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}
    </div>
  );
});

LicenseKeysList.displayName = 'LicenseKeysList';

export default LicenseKeysList;