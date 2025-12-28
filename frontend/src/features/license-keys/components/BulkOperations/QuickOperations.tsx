import React from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Play, PauseCircle, Clock, Trash2 } from 'lucide-react';

interface QuickOperationsProps {
  onPause: () => void;
  onActivate: () => void;
  onAddHours: () => void;
  onDelete: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export const QuickOperations: React.FC<QuickOperationsProps> = ({
  onPause,
  onActivate,
  onAddHours,
  onDelete,
  isLoading,
  disabled,
}) => {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-blue-700">Quick Operations (all keys)</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={onPause}
          disabled={isLoading || disabled}
          size="sm"
        >
          <PauseCircle className="h-4 w-4 mr-2" />
          {isLoading ? 'Processing...' : 'Pause'}
        </Button>
        <Button
          variant="outline"
          onClick={onActivate}
          disabled={isLoading || disabled}
          size="sm"
        >
          <Play className="h-4 w-4 mr-2" />
          {isLoading ? 'Processing...' : 'Activate'}
        </Button>
        <Button
          variant="outline"
          onClick={onAddHours}
          disabled={isLoading || disabled}
          size="sm"
        >
          <Clock className="h-4 w-4 mr-2" />
          {isLoading ? 'Processing...' : 'Add Hours'}
        </Button>
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={isLoading || disabled}
          size="sm"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {isLoading ? 'Processing...' : 'Delete All'}
        </Button>
      </div>
    </div>
  );
};

