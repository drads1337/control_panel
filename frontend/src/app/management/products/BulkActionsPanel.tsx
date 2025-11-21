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
  canDeleteProducts: boolean;
}

export const BulkActionsPanel: React.FC<BulkActionsPanelProps> = ({
  selectedCount,
  bulkAction,
  onBulkActionChange,
  onApply,
  onClear,
  canManageStatus,
  canDeleteProducts,
}) => {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
      <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
      <ConditionalRender 
        permissions={['products.status', 'products.delete']}
        requireAll={false}
        fallback={null}
      >
        <Select value={bulkAction} onValueChange={onBulkActionChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <ConditionalRender permission="products.status" fallback={null}>
              <SelectItem value="active">Activate</SelectItem>
              <SelectItem value="inactive">Deactivate</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="testing">Testing</SelectItem>
            </ConditionalRender>
            <ConditionalRender permission="products.delete" fallback={null}>
              <SelectItem value="delete">Delete</SelectItem>
            </ConditionalRender>
          </SelectContent>
        </Select>
      </ConditionalRender>
      <ConditionalRender 
        permissions={['products.status', 'products.delete']}
        requireAll={false}
        fallback={null}
      >
        <Button onClick={onApply} disabled={!bulkAction || (!canManageStatus && !canDeleteProducts)} size="sm">
          Apply
        </Button>
      </ConditionalRender>
      <Button variant="ghost" onClick={onClear} size="sm">
        Clear
      </Button>
    </div>
  );
};
