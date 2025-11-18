import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gamepad2 } from 'lucide-react';

interface GameSelectorProps {
  games: Array<{ id: number; name: string }>;
  value: string;
  onChange: (value: string) => void;
}

export const GameSelector: React.FC<GameSelectorProps> = ({ games, value, onChange }) => {
  if (games.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Game</Label>
        <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
          <div className="text-center">
            <Gamepad2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Create the application</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">Game</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a game" />
        </SelectTrigger>
        <SelectContent>
          {games.map((game) => (
            <SelectItem key={game.id} value={game.id.toString()}>
              {game.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
