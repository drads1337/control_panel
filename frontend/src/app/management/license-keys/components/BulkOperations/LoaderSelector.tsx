import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Gamepad2 } from 'lucide-react';

interface LoaderSelectorProps {
  loaders: Array<{ id: number; name: string }>;
  loaderId: string;
  selectedGames: number[];
  availableGames: Array<{ id: number; name: string }>;
  loadersLoading: boolean;
  onLoaderChange: (loaderId: string) => void;
  onGamesChange: (gameIds: number[]) => void;
}

export const LoaderSelector: React.FC<LoaderSelectorProps> = ({
  loaders,
  loaderId,
  selectedGames,
  availableGames,
  loadersLoading,
  onLoaderChange,
  onGamesChange,
}) => {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allGameIds = availableGames.map(game => game.id);
      onGamesChange(allGameIds);
    } else {
      onGamesChange([]);
    }
  };

  const handleGameToggle = (gameId: number, checked: boolean) => {
    if (checked) {
      onGamesChange([...selectedGames, gameId]);
    } else {
      onGamesChange(selectedGames.filter(id => id !== gameId));
    }
  };

  const allSelected = availableGames.length > 0 && selectedGames.length === availableGames.length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Loader</Label>
        <Select value={loaderId} onValueChange={onLoaderChange} disabled={loadersLoading}>
          <SelectTrigger>
            <SelectValue placeholder={loadersLoading ? "Loading loaders..." : "Select a loader"} />
          </SelectTrigger>
          <SelectContent>
            {loaders.map((loader) => (
              <SelectItem key={loader.id} value={loader.id.toString()}>
                {loader.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {loaderId && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Select Games</Label>
          {availableGames.length === 0 ? (
            <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
              <div className="text-center">
                <Gamepad2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Create the application</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all-bulk-ops-games"
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all-bulk-ops-games" className="text-sm font-medium">All Games</Label>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {availableGames.map(game => (
                  <div key={game.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bulk-ops-game-${game.id}`}
                      checked={selectedGames.includes(game.id)}
                      onCheckedChange={(checked) => handleGameToggle(game.id, checked as boolean)}
                    />
                    <Label htmlFor={`bulk-ops-game-${game.id}`} className="text-sm font-normal">
                      {game.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

