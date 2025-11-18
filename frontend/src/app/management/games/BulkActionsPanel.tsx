import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConditionalRender } from '@/components/rbac/conditional-render';

interface BulkActionsPanelProps {
  selectedCount: number;
  bulkAction: string;
  onBulkActionChange: (action: string) => void;
  onApply: () => void;
  onClear: () => void;
  canManageStatus: boolean;
  canDeleteGames: boolean;
}

export const BulkActionsPanel: React.FC<BulkActionsPanelProps> = ({
  selectedCount,
  bulkAction,
  onBulkActionChange,
  onApply,
  onClear,
  canManageStatus,
  canDeleteGames,
}) => {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
      <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
      <ConditionalRender 
        permissions={['games.status', 'games.delete']}
        requireAll={false}
        fallback={null}
      >
        <Select value={bulkAction} onValueChange={onBulkActionChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <ConditionalRender permission="games.status" fallback={null}>
              <SelectItem value="active">Activate</SelectItem>
              <SelectItem value="inactive">Deactivate</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="testing">Testing</SelectItem>
            </ConditionalRender>
            <ConditionalRender permission="games.delete" fallback={null}>
              <SelectItem value="delete">Delete</SelectItem>
            </ConditionalRender>
          </SelectContent>
        </Select>
      </ConditionalRender>
      <ConditionalRender 
        permissions={['games.status', 'games.delete']}
        requireAll={false}
        fallback={null}
      >
        <Button onClick={onApply} disabled={!bulkAction || (!canManageStatus && !canDeleteGames)} size="sm">
          Apply
        </Button>
      </ConditionalRender>
      <Button variant="ghost" onClick={onClear} size="sm">
        Clear
      </Button>
    </div>
  );
};
