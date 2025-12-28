import React from 'react';
import { Button } from '@/components/ui/button';
import { Target, Trash2, RefreshCw, Clock } from 'lucide-react';

interface FilteredOperationsProps {
  keysCount: number;
  onDelete: () => void;
  onReset: () => void;
  onExtend: () => void;
  isLoading: boolean;
}

export const FilteredOperations: React.FC<FilteredOperationsProps> = ({
  keysCount,
  onDelete,
  onReset,
  onExtend,
  isLoading,
}) => {
  if (keysCount === null || keysCount === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-green-700">
          Filtered Operations ({keysCount} keys)
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={isLoading}
          size="sm"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {isLoading ? 'Processing...' : `Delete ${keysCount}`}
        </Button>
        <Button
          variant="outline"
          onClick={onReset}
          disabled={isLoading}
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {isLoading ? 'Processing...' : `Reset ${keysCount}`}
        </Button>
        <Button
          variant="outline"
          onClick={onExtend}
          disabled={isLoading}
          size="sm"
        >
          <Clock className="h-4 w-4 mr-2" />
          {isLoading ? 'Processing...' : `Extend ${keysCount}`}
        </Button>
      </div>
    </div>
  );
};

