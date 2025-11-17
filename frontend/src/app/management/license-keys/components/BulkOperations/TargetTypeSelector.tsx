import React from 'react';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Gamepad2, Container } from 'lucide-react';

interface TargetTypeSelectorProps {
  value: 'game' | 'loader';
  onChange: (value: 'game' | 'loader') => void;
}

export const TargetTypeSelector: React.FC<TargetTypeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">Target Type</Label>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(val) => val && onChange(val as 'game' | 'loader')}
        className="grid grid-cols-2 w-full"
      >
        <ToggleGroupItem 
          value="game" 
          className="flex items-center justify-center gap-2 h-10 text-sm font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted hover:border-muted-foreground/20 transition-colors"
        >
          <Gamepad2 className="h-4 w-4" />
          Game
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="loader" 
          className="flex items-center justify-center gap-2 h-10 text-sm font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted hover:border-muted-foreground/20 transition-colors"
        >
          <Container className="h-4 w-4" />
          Loader
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};

