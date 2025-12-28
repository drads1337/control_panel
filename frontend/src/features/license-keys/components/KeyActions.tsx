import React from 'react';
import {
  Eye, Edit2, Trash2, PauseCircle, Play, 
  RotateCcw, Clock, Copy, Lock, Unlock
} from 'lucide-react';
import type { LicenseKey } from '@/entities/key';
import { KEY_STATUS } from '@/shared/constants/key-status';
import { ActionButton } from './ActionButton';

interface KeyActionsProps {
  keyData: LicenseKey;
  onKeyAction: (action: string, keyId: number) => void;
  onViewDetails: (key: LicenseKey) => void;
  canPerformAction: (key: LicenseKey, actionPermission: boolean) => boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canReset?: boolean;
  canPauseResume?: boolean;
  canExtend?: boolean;
  canBlock?: boolean;
  isLoading?: boolean;
}

export const KeyActions: React.FC<KeyActionsProps> = React.memo(({
  keyData,
  onKeyAction,
  onViewDetails,
  canPerformAction,
  canEdit = false,
  canDelete = false,
  canReset = false,
  canPauseResume = false,
  canExtend = false,
  canBlock = false,
  isLoading = false,
}) => {
  return (
    <div className="flex items-center justify-end space-x-1 flex-wrap">
      <ActionButton
        permission="keys.see_analytics"
        onClick={() => onViewDetails(keyData)}
        ariaLabel="View Details"
        tooltip="View Details"
      >
        <Eye className="h-4 w-4" />
      </ActionButton>

      <ActionButton
        permission="keys.edit"
        onClick={() => onKeyAction('edit', keyData.id)}
        disabled={!canPerformAction(keyData, canEdit)}
        ariaLabel="Edit"
        tooltip="Edit"
      >
        <Edit2 className="h-4 w-4" />
      </ActionButton>

      <ActionButton
        permission="keys.copy"
        onClick={() => onKeyAction('copy', keyData.id)}
        ariaLabel="Copy to clipboard"
        tooltip="Copy to clipboard"
      >
        <Copy className="h-4 w-4" />
      </ActionButton>

      {canPauseResume && (
        <>
          {keyData.status === KEY_STATUS.ACTIVE && (
            <ActionButton
              permission="keys.pause_resume"
              onClick={() => onKeyAction('pause', keyData.id)}
              disabled={isLoading || !canPerformAction(keyData, canPauseResume)}
              isLoading={isLoading}
              ariaLabel="Pause"
              tooltip="Pause"
            >
              <PauseCircle className="h-4 w-4" />
            </ActionButton>
          )}
          {keyData.status === KEY_STATUS.PAUSED && (
            <ActionButton
              permission="keys.pause_resume"
              onClick={() => onKeyAction('resume', keyData.id)}
              disabled={isLoading || !canPerformAction(keyData, canPauseResume)}
              isLoading={isLoading}
              ariaLabel="Resume"
              tooltip="Resume"
            >
              <Play className="h-4 w-4" />
            </ActionButton>
          )}
        </>
      )}

      <ActionButton
        permission="keys.extend"
        onClick={() => onKeyAction('extend', keyData.id)}
        disabled={!canPerformAction(keyData, canExtend)}
        ariaLabel="Extend"
        tooltip="Extend"
      >
        <Clock className="h-4 w-4" />
      </ActionButton>

      <ActionButton
        permission="keys.reset_pc_binding"
        onClick={() => onKeyAction('reset', keyData.id)}
        disabled={!canPerformAction(keyData, canReset)}
        ariaLabel={`Reset PC binding for key ${keyData.id}`}
        tooltip="Reset"
      >
        <RotateCcw className="h-4 w-4" />
      </ActionButton>

      {canBlock && (
        <>
          {keyData.status === KEY_STATUS.BLOCKED ? (
            <ActionButton
              permission="keys.block"
              onClick={() => onKeyAction('unblock', keyData.id)}
              disabled={isLoading || !canPerformAction(keyData, canBlock)}
              isLoading={isLoading}
              ariaLabel={`Unblock key ${keyData.id}`}
              tooltip="Unblock"
            >
              <Unlock className="h-4 w-4" />
            </ActionButton>
          ) : (
            <ActionButton
              permission="keys.block"
              onClick={() => onKeyAction('block', keyData.id)}
              disabled={isLoading || !canPerformAction(keyData, canBlock)}
              isLoading={isLoading}
              ariaLabel={`Block key ${keyData.id}`}
              tooltip="Block"
            >
              <Lock className="h-4 w-4" />
            </ActionButton>
          )}
        </>
      )}

      <ActionButton
        permission="keys.delete"
        onClick={() => onKeyAction('delete', keyData.id)}
        disabled={!canPerformAction(keyData, canDelete)}
        variant="destructive"
        ariaLabel="Delete"
        tooltip="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </ActionButton>
    </div>
  );
});

KeyActions.displayName = 'KeyActions';

