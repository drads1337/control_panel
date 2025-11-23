import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { X } from 'lucide-react'; // Добавим иконку для компактности

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
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/30 rounded-lg w-full transition-all">
      {/* Mobile: Top Row (Count + Clear), Desktop: Left side */}
      <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {selectedCount} selected
        </span>
        
        {/* Mobile Clear Button (Visible only on mobile) */}
        <Button 
          variant="ghost" 
          onClick={onClear} 
          size="sm" 
          className="h-8 px-2 sm:hidden text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" /> Clear
        </Button>
      </div>

      {/* Mobile: Bottom Row (Actions), Desktop: Right side */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <ConditionalRender 
          permissions={['products.status', 'products.delete']}
          requireAll={false}
          fallback={null}
        >
          <div className="flex-1 sm:w-auto">
            <Select value={bulkAction} onValueChange={onBulkActionChange}>
              <SelectTrigger className="w-full sm:w-40">
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
          </div>
          
          <Button 
            onClick={onApply} 
            disabled={!bulkAction || (!canManageStatus && !canDeleteProducts)} 
            size="sm"
            className="flex-1 sm:flex-none"
          >
            Apply
          </Button>
        </ConditionalRender>
      </div>

      {/* Desktop Clear Button (Hidden on mobile) */}
      <Button 
        variant="ghost" 
        onClick={onClear} 
        size="sm"
        className="hidden sm:inline-flex"
      >
        Clear
      </Button>
    </div>
  );
};