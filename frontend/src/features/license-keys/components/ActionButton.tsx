import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConditionalRender } from '@/lib/rbac/conditional-render';

interface ActionButtonProps {
  permission?: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  ariaLabel: string;
  tooltip: string;
  children: React.ReactNode;
  variant?: 'ghost' | 'destructive';
}

export const ActionButton: React.FC<ActionButtonProps> = React.memo(({
  permission,
  onClick,
  disabled = false,
  isLoading = false,
  ariaLabel,
  tooltip,
  children,
  variant = 'ghost',
}) => {
  const button = (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      className={variant === 'destructive' ? 'h-8 w-8 p-0 text-destructive hover:text-destructive' : 'h-8 w-8 p-0'}
      disabled={disabled || isLoading}
      aria-label={ariaLabel}
    >
      {isLoading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" aria-hidden="true"></div>
      ) : (
        children
      )}
    </Button>
  );

  if (permission) {
    return (
      <ConditionalRender permission={permission} fallback={null}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {button}
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ConditionalRender>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

ActionButton.displayName = 'ActionButton';

