import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

interface AgentSelectionCheckboxProps {
  agentId: number;
  isSelected: boolean;
  onToggleSelection: (agentId: number) => void;
}

export const AgentSelectionCheckbox: React.FC<AgentSelectionCheckboxProps> = React.memo(({
  agentId,
  isSelected,
  onToggleSelection,
}) => {
  return (
    <Checkbox
      checked={isSelected}
      onCheckedChange={() => onToggleSelection(agentId)}
      className="flex-shrink-0"
    />
  );
});

AgentSelectionCheckbox.displayName = 'AgentSelectionCheckbox';

