import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination-ui';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import {
  Eye, EyeOff, Edit2, Trash2, PauseCircle, Play, 
  RotateCcw, Clock, Copy, Lock, Unlock, Package
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LicenseKey } from '@/entities/key';
import { KEY_STATUS } from '@/constants';

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

const LicenseKeysList: React.FC<LicenseKeysListProps> = ({
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
  const allSelected = keys.length > 0 && keys.every(key => selectedKeys.has(key.id));
  const someSelected = keys.some(key => selectedKeys.has(key.id));

  const parentRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const shouldVirtualize = keys.length > 50;

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

  const isOwnKey = (key: LicenseKey) => {
    return key.user_id === currentUserId;
  };

  const canPerformAction = (key: LicenseKey, actionPermission: boolean) => {
    if (!actionPermission) return false;
    if (isOwnKey(key)) return true;
    return canManage;
  };

  const getStatusType = (status: number): StatusType => {
    switch (status) {
      case KEY_STATUS.BLOCKED:
        return 'blocked';
      case KEY_STATUS.ACTIVE:
        return 'active';
      case KEY_STATUS.EXPIRED:
        return 'expired';
      case KEY_STATUS.PAUSED:
        return 'inactive';
      default:
        return 'inactive';
    }
  };

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

  const KeyRow = React.memo<{
    keyData: LicenseKey;
    isSelected: boolean;
    isKeyVisible: boolean;
    fullKey: string | undefined;
    isLoading: boolean;
    onToggleKeyVisibility: (keyId: number) => void;
    onSelectKey: (keyId: number, selected: boolean) => void;
    onKeyAction: (action: string, keyId: number) => void;
    onViewDetails: (key: LicenseKey) => void;
    canPerformAction: (key: LicenseKey, actionPermission: boolean) => boolean;
    getStatusType: (status: number) => StatusType;
    canEdit?: boolean;
    canDelete?: boolean;
    canReset?: boolean;
    canPauseResume?: boolean;
    canExtend?: boolean;
    canBlock?: boolean;
    style?: React.CSSProperties;
  }>(({ 
    keyData, 
    isSelected, 
    isKeyVisible, 
    fullKey, 
    isLoading,
    onToggleKeyVisibility,
    onSelectKey,
    onKeyAction,
    onViewDetails,
    canPerformAction,
    getStatusType,
    canEdit = false,
    canDelete = false,
    canReset = false,
    canPauseResume = false,
    canExtend = false,
    canBlock = false,
    style
  }) => (
    <TableRow style={style}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectKey(keyData.id, checked as boolean)}
        />
      </TableCell>
      <TableCell className="text-left">
        <div className="flex items-center space-x-2">
          <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
            {isKeyVisible ? (fullKey || keyData.key) : '••••••••••••••••'}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleKeyVisibility(keyData.id)}
            title={isKeyVisible ? 'Hide key' : 'Show key'}
          >
            {isKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-left">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{keyData.game_name}</span>
          {keyData.is_access_code && (
            <Badge variant="secondary" className="text-xs">
              Access Code
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-left">
        <Badge
          className={getStatusClasses(getStatusType(keyData.status))}
          variant="secondary"
        >
          {getStatusText(getStatusType(keyData.status))}
        </Badge>
      </TableCell>
      <TableCell className="text-left">
        <div className="text-sm">
          {keyData.activated_at ? (
            <>
              <div className="font-medium">
                {keyData.expires_at ? (
                  (() => {
                    const now = new Date();
                    const expires = new Date(keyData.expires_at);
                    const diffMs = expires.getTime() - now.getTime();
                    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
                    return diffHours > 0 ? `${diffHours}h left` : 'Expired';
                  })()
                ) : 'Never expires'}
              </div>
              <div className="text-muted-foreground">
                {keyData.expires_at ? new Date(keyData.expires_at).toLocaleDateString() : 'Never'}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">{keyData.duration_hours}h</div>
              <div className="text-muted-foreground">Not activated</div>
            </>
          )}
        </div>
      </TableCell>
      <TableCell className="text-left">
        <div className="text-sm">
          <div className="font-medium">{keyData.device_count || 0}/{keyData.max_devices}</div>
          <div className="text-muted-foreground">devices</div>
        </div>
      </TableCell>
      <TableCell className="text-left">
        <div className="text-sm text-muted-foreground">
          {keyData.created_at ? new Date(keyData.created_at).toLocaleDateString() : 'Unknown'}
        </div>
      </TableCell>
      <TableCell className="w-auto text-right">
        <div className="flex items-center justify-end space-x-1 flex-wrap">
          <ConditionalRender permission="keys.see_analytics" fallback={null}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onViewDetails(keyData)} className="h-8 w-8 p-0" aria-label="View Details">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </ConditionalRender>

          <ConditionalRender permission="keys.edit" fallback={null}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onKeyAction('edit', keyData.id)} className="h-8 w-8 p-0" disabled={!canPerformAction(keyData, canEdit)} aria-label="Edit">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </ConditionalRender>

              <ConditionalRender permission="keys.copy" fallback={null}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => onKeyAction('copy', keyData.id)} className="h-8 w-8 p-0" aria-label="Copy to clipboard">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy to clipboard</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </ConditionalRender>

              <ConditionalRender permission="keys.pause_resume" fallback={null}>
              {keyData.status === KEY_STATUS.ACTIVE ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onKeyAction('pause', keyData.id)} 
                      className="h-8 w-8 p-0"
                      disabled={isLoading || !canPerformAction(keyData, canPauseResume)}
                      aria-label="Pause"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" aria-hidden="true"></div>
                      ) : (
                        <PauseCircle className="h-4 w-4" />
                      )}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>Pause</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : keyData.status === KEY_STATUS.PAUSED ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onKeyAction('resume', keyData.id)} 
                      className="h-8 w-8 p-0"
                      disabled={isLoading || !canPerformAction(keyData, canPauseResume)}
                      aria-label="Resume"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" aria-hidden="true"></div>
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>Resume</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              </ConditionalRender>

              <ConditionalRender permission="keys.extend" fallback={null}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onKeyAction('extend', keyData.id)} className="h-8 w-8 p-0" disabled={!canPerformAction(keyData, canExtend)} aria-label="Extend">
                      <Clock className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Extend</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </ConditionalRender>

              <ConditionalRender permission="keys.reset_pc_binding" fallback={null}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onKeyAction('reset', keyData.id)} className="h-8 w-8 p-0" disabled={!canPerformAction(keyData, canReset)} aria-label={`Reset PC binding for key ${keyData.id}`}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </ConditionalRender>

              <ConditionalRender permission="keys.block" fallback={null}>
              {keyData.status === KEY_STATUS.BLOCKED ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onKeyAction('unblock', keyData.id)} 
                      className="h-8 w-8 p-0"
                      disabled={isLoading || !canPerformAction(keyData, canBlock)}
                      aria-label={`Unblock key ${keyData.id}`}
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" aria-hidden="true"></div>
                      ) : (
                        <Unlock className="h-4 w-4" />
                      )}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>Unblock</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : keyData.status !== KEY_STATUS.BLOCKED ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onKeyAction('block', keyData.id)} 
                      className="h-8 w-8 p-0"
                      disabled={isLoading || !canPerformAction(keyData, canBlock)}
                      aria-label={`Block key ${keyData.id}`}
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" aria-hidden="true"></div>
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>Block</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              </ConditionalRender>

              <ConditionalRender permission="keys.delete" fallback={null}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => onKeyAction('delete', keyData.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={!canPerformAction(keyData, canDelete)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  </ConditionalRender>
                </div>
              </TableCell>
    </TableRow>
  ));

  KeyRow.displayName = 'KeyRow';

  const renderKeyRowCells = (key: LicenseKey) => (
    <>
      <TableCell>
        <Checkbox
          checked={selectedKeys.has(key.id)}
          onCheckedChange={(checked) => onSelectKey(key.id, checked as boolean)}
        />
      </TableCell>
      <TableCell className="text-left">
        <div className="flex items-center space-x-2">
          <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
            {showKey[key.id] ? (fullKeys[key.id] || key.key) : '••••••••••••••••'}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleKeyVisibility(key.id)}
            title={showKey[key.id] ? 'Hide key' : 'Show key'}
          >
            {showKey[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-left">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{key.game_name}</span>
          {key.is_access_code && (
            <Badge variant="secondary" className="text-xs">
              Access Code
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-left">
        <Badge
          className={getStatusClasses(getStatusType(key.status))}
          variant="secondary"
        >
          {getStatusText(getStatusType(key.status))}
        </Badge>
      </TableCell>
      <TableCell className="text-left">
        <div className="text-sm">
          {key.activated_at ? (
            <>
              <div className="font-medium">
                {key.expires_at ? (
                  (() => {
                    const now = new Date();
                    const expires = new Date(key.expires_at);
                    const diffMs = expires.getTime() - now.getTime();
                    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
                    return diffHours > 0 ? `${diffHours}h left` : 'Expired';
                  })()
                ) : 'Never expires'}
              </div>
              <div className="text-muted-foreground">
                {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">{key.duration_hours}h</div>
              <div className="text-muted-foreground">Not activated</div>
            </>
          )}
        </div>
      </TableCell>
      <TableCell className="text-left">
        <div className="text-sm">
          <div className="font-medium">{key.device_count || 0}/{key.max_devices}</div>
          <div className="text-muted-foreground">devices</div>
        </div>
      </TableCell>
      <TableCell className="text-left">
        <div className="text-sm text-muted-foreground">
          {key.created_at ? new Date(key.created_at).toLocaleDateString() : 'Unknown'}
        </div>
      </TableCell>
      <TableCell className="w-auto text-right">
        <div className="flex items-center justify-end space-x-1 flex-wrap">
          <ConditionalRender permission="keys.see_analytics" fallback={null}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onViewDetails(key)} className="h-8 w-8 p-0" aria-label="View Details">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </ConditionalRender>

          <ConditionalRender permission="keys.edit" fallback={null}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onKeyAction('edit', key.id)} className="h-8 w-8 p-0" disabled={!canPerformAction(key, canEdit)} aria-label="Edit">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </ConditionalRender>

              <ConditionalRender permission="keys.copy" fallback={null}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => onKeyAction('copy', key.id)} className="h-8 w-8 p-0" aria-label="Copy to clipboard">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy to clipboard</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </ConditionalRender>

              <ConditionalRender permission="keys.pause_resume" fallback={null}>
              {key.status === KEY_STATUS.ACTIVE ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onKeyAction('pause', key.id)} 
                      className="h-8 w-8 p-0"
                      disabled={actionLoading.has(key.id) || !canPerformAction(key, canPauseResume)}
                      aria-label="Pause"
                    >
                      {actionLoading.has(key.id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" aria-hidden="true"></div>
                      ) : (
                        <PauseCircle className="h-4 w-4" />
                      )}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>Pause</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : key.status === KEY_STATUS.PAUSED ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onKeyAction('resume', key.id)} 
                      className="h-8 w-8 p-0"
                      disabled={actionLoading.has(key.id) || !canPerformAction(key, canPauseResume)}
                      aria-label="Resume"
                    >
                      {actionLoading.has(key.id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" aria-hidden="true"></div>
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>Resume</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              </ConditionalRender>

              <ConditionalRender permission="keys.extend" fallback={null}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onKeyAction('extend', key.id)} className="h-8 w-8 p-0" disabled={!canPerformAction(key, canExtend)} aria-label="Extend">
                      <Clock className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Extend</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </ConditionalRender>

              <ConditionalRender permission="keys.reset_pc_binding" fallback={null}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onKeyAction('reset', key.id)} className="h-8 w-8 p-0" disabled={!canPerformAction(key, canReset)} aria-label="Reset PC binding">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </ConditionalRender>

              <ConditionalRender permission="keys.block" fallback={null}>
              {key.status === KEY_STATUS.BLOCKED ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onKeyAction('unblock', key.id)} 
                      className="h-8 w-8 p-0"
                      disabled={actionLoading.has(key.id) || !canPerformAction(key, canBlock)}
                      aria-label="Unblock"
                    >
                      {actionLoading.has(key.id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" aria-hidden="true"></div>
                      ) : (
                        <Unlock className="h-4 w-4" />
                      )}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>Unblock</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : key.status !== KEY_STATUS.BLOCKED ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onKeyAction('block', key.id)} 
                      className="h-8 w-8 p-0"
                      disabled={actionLoading.has(key.id) || !canPerformAction(key, canBlock)}
                      aria-label="Block"
                    >
                      {actionLoading.has(key.id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" aria-hidden="true"></div>
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>Block</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              </ConditionalRender>

              <ConditionalRender permission="keys.delete" fallback={null}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => onKeyAction('delete', key.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={!canPerformAction(key, canDelete)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  </ConditionalRender>
                </div>
              </TableCell>
            </>
          );

  return (
    <div className="space-y-4">
      {}
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

      <div className="rounded-md border">
        <Table style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '20%' }} />
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
              <TableHead className="text-left">Game</TableHead>
              <TableHead className="text-left">Status</TableHead>
              <TableHead className="text-left">Time</TableHead>
              <TableHead className="text-left">Devices</TableHead>
              <TableHead className="text-left">Created</TableHead>
              <TableHead className="w-auto text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
        {}
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
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '20%' }} />
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
                        getStatusType={getStatusType}
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
              <col style={{ width: '20%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '20%' }} />
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
                  getStatusType={getStatusType}
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

      {}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground whitespace-nowrap">Showing {((pagination.page - 1) * pagination.perPage) + 1} to {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total} keys</div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (pagination.page > 1) {
                      handlePageChange(pagination.page - 1);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  className={pagination.page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>

              {}
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                let pageNum: number;

                if (pagination.pages <= 5) {

                  pageNum = i + 1;
                } else if (pagination.page <= 3) {

                  pageNum = i + 1;
                } else if (pagination.page >= pagination.pages - 2) {

                  pageNum = pagination.pages - 4 + i;
                } else {

                  pageNum = pagination.page - 2 + i;
                }

                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePageChange(pageNum);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      isActive={pagination.page === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              {pagination.pages > 5 && pagination.page < pagination.pages - 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (pagination.page < pagination.pages) {
                      handlePageChange(pagination.page + 1);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  className={pagination.page >= pagination.pages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default LicenseKeysList;