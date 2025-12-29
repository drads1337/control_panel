import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import type { LicenseKey } from '@/entities/key';
import { KEY_STATUS } from '@/shared/constants/key-status';
import { KeyDisplay } from './KeyDisplay';
import { KeyActions } from './KeyActions';

interface KeyRowProps {
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
  getStatusType: (status: number, is_expired?: boolean, activated_at?: string | null) => StatusType;
  canEdit?: boolean;
  canDelete?: boolean;
  canReset?: boolean;
  canPauseResume?: boolean;
  canExtend?: boolean;
  canBlock?: boolean;
  style?: React.CSSProperties;
}

export const KeyRow: React.FC<KeyRowProps> = React.memo(({
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
  style,
}) => {
  const formatExpirationTime = (expiresAt: string | null, status?: number, is_expired?: boolean): string => {
    // Blocked keys (status = 2) should never show as "Expired"
    // But we need to check is_expired flag to distinguish blocked from expired
    if (status === KEY_STATUS.BLOCKED && !is_expired) {
      return 'Blocked';
    }
    if (!expiresAt) return 'Never expires';
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    // Only show "Expired" if key is actually expired AND not blocked
    if (diffHours <= 0 && is_expired && status !== KEY_STATUS.BLOCKED) {
      return 'Expired';
    }
    return diffHours > 0 ? `${diffHours}h left` : 'Expired';
  };

  return (
    <TableRow style={style}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectKey(keyData.id, checked as boolean)}
        />
      </TableCell>
      
      <TableCell className="text-left">
        <KeyDisplay
          keyId={keyData.id}
          keyValue={fullKey || keyData.key}
          isVisible={isKeyVisible}
          onToggleVisibility={onToggleKeyVisibility}
        />
      </TableCell>
      
      <TableCell className="text-left">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{keyData.product_name}</span>
          {keyData.is_access_code && (
            <Badge variant="secondary" className="text-xs">
              Access Code
            </Badge>
          )}
        </div>
      </TableCell>
      
      <TableCell className="text-left">
        <Badge variant={keyData.agent_id ? "default" : "secondary"} className="text-xs">
          {keyData.agent_id ? 'Agent' : 'Product'}
        </Badge>
      </TableCell>
      
      <TableCell className="text-left">
        <Badge
          className={getStatusClasses(getStatusType(keyData.status, keyData.is_expired, keyData.activated_at))}
          variant="secondary"
        >
          {getStatusText(getStatusType(keyData.status, keyData.is_expired, keyData.activated_at))}
        </Badge>
      </TableCell>
      
      <TableCell className="text-left">
        <div className="text-sm">
          {keyData.activated_at ? (
            <>
              <div className="font-medium">
                {formatExpirationTime(keyData.expires_at, keyData.status, keyData.is_expired)}
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
        <div className="text-sm">
          <div className="text-muted-foreground">
            {keyData.created_at ? new Date(keyData.created_at).toLocaleDateString() : 'Unknown'}
          </div>
          {keyData.creator_username && (
            <div className="text-xs text-muted-foreground mt-1">
              by {keyData.creator_username}
            </div>
          )}
        </div>
      </TableCell>
      
      <TableCell className="w-auto text-right">
        <KeyActions
          keyData={keyData}
          onKeyAction={onKeyAction}
          onViewDetails={onViewDetails}
          canPerformAction={canPerformAction}
          canEdit={canEdit}
          canDelete={canDelete}
          canReset={canReset}
          canPauseResume={canPauseResume}
          canExtend={canExtend}
          canBlock={canBlock}
          isLoading={isLoading}
        />
      </TableCell>
    </TableRow>
  );
});

KeyRow.displayName = 'KeyRow';

