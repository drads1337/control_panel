import React from 'react';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Database, Container } from 'lucide-react';

interface TargetTypeSelectorProps {
  value: 'product' | 'agent';
  onChange: (value: 'product' | 'agent') => void;
}

export const TargetTypeSelector: React.FC<TargetTypeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Target Type</Label>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(val) => val && onChange(val as 'product' | 'agent')}
        className="flex w-full gap-1"
      >
        <ToggleGroupItem 
          value="product" 
          className="flex-1 flex items-center justify-center gap-1 h-8 text-xs font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted transition-colors"
        >
          <Database className="h-3 w-3" />
          Product
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="agent" 
          className="flex-1 flex items-center justify-center gap-1 h-8 text-xs font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted transition-colors"
        >
          <Container className="h-3 w-3" />
          Agent
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};

