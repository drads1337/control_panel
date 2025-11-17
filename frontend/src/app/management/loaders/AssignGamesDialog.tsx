import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { type Loader } from '@/entities/loader';
import { getGames, getGamesAvailableForAssignment, type Game } from '@/entities/game';

// Common game item component to avoid duplication
const GameItem = React.memo<{
  game: Game;
  isSelected: boolean;
  onToggle: (gameId: number) => void;
  prefix: string;
  hoverClass: string;
}>(function GameItem({ game, isSelected, onToggle, prefix, hoverClass }) {
  return (
    <div key={game.id} className={`flex items-center space-x-2 p-2 ${hoverClass} rounded-md`}>
      <Checkbox
        id={`${prefix}-game-${game.id}`}
        checked={isSelected}
        onCheckedChange={() => onToggle(game.id)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${prefix}-game-${game.id}`} className="font-medium cursor-pointer">
            {game.name}
          </Label>
          <Badge variant="outline" className="text-xs">
            {game.version}
          </Badge>
          {game.is_multi_app ? (
            <Badge variant="default" className="text-xs">
              Multi-App
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Library
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
});

// Common section header component
const SectionHeader: React.FC<{
  title: string;
  count: number;
  selectedCount: number;
  checkboxId: string;
  isChecked: boolean;
  onToggle: () => void;
  badgeVariant: "destructive" | "secondary";
}> = ({ title, count, selectedCount, checkboxId, isChecked, onToggle, badgeVariant }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-2">
      <Checkbox
        id={checkboxId}
        checked={isChecked}
        onCheckedChange={onToggle}
      />
      <Label htmlFor={checkboxId} className="text-sm font-medium">
        {title} ({count})
      </Label>
    </div>
    <Badge variant={badgeVariant}>
      {selectedCount} selected
    </Badge>
  </div>
);

interface AssignGamesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loader: Loader | null;
  onAssign: (loaderId: number, gameIds: number[]) => Promise<void>;
  onUnassign?: (loaderId: number, gameIds: number[]) => Promise<void>;
}

const AssignGamesDialog: React.FC<AssignGamesDialogProps> = ({
  open,
  onOpenChange,
  loader,
  onAssign,
  onUnassign,
}) => {
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [assignedGames, setAssignedGames] = useState<Game[]>([]);
  const [selectedGames, setSelectedGames] = useState<number[]>([]);
  const [selectedAssignedGames, setSelectedAssignedGames] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  useEffect(() => {
    if (open && loader) {
      loadAvailableGames();
      loadAssignedGames();
    }
  }, [open, loader]);

  const loadAvailableGames = async () => {
    setLoading(true);
    try {
      // Use optimized endpoint that only returns unassigned multi-app games
      const response = await getGamesAvailableForAssignment(1, 100); // Load up to 100 games
      setAvailableGames(response.games || []);
    } catch (error) {
      console.error('[AssignGamesDialog] Failed to load available games:', error);
      setAvailableGames([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedGames = async () => {
    if (!loader?.assigned_games || loader.assigned_games.length === 0) {
      setAssignedGames([]);
      return;
    }

    try {
      // Only load games that are assigned to this loader
      const response = await getGames('all');
      const allGames = response.games || [];
      const assigned = allGames.filter(game => 
        loader.assigned_games.includes(game.id)
      );
      setAssignedGames(assigned);
    } catch (error) {
      console.error('[AssignGamesDialog] Failed to load assigned games:', error);
      setAssignedGames([]);
    }
  };


  const handleGameToggle = (gameId: number) => {
    setSelectedGames(prev =>
      prev.includes(gameId)
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    );
  };

  const handleSelectAll = () => {
    if (selectedGames.length === availableGames.length) {
      setSelectedGames([]);
    } else {
      setSelectedGames(availableGames.map(game => game.id));
    }
  };

  const handleAssignedGameToggle = (gameId: number) => {
    setSelectedAssignedGames(prev =>
      prev.includes(gameId)
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    );
  };

  const handleSelectAllAssigned = () => {
    if (selectedAssignedGames.length === assignedGames.length) {
      setSelectedAssignedGames([]);
    } else {
      setSelectedAssignedGames(assignedGames.map(game => game.id));
    }
  };


  const handleAssign = async () => {
    if (!loader || selectedGames.length === 0) return;

    setAssigning(true);
    try {
      await onAssign(loader.id, selectedGames);
      setSelectedGames([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to assign games:', error);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    if (!loader || selectedAssignedGames.length === 0 || !onUnassign) return;

    setUnassigning(true);
    try {
      await onUnassign(loader.id, selectedAssignedGames);
      setSelectedAssignedGames([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to unassign games:', error);
    } finally {
      setUnassigning(false);
    }
  };

  const handleClose = () => {
    setSelectedGames([]);
    setSelectedAssignedGames([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Games to Loader</DialogTitle>
          <DialogDescription>
            Select games to assign to this loader. Games already assigned to other loaders are not available for assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Assigned Games Section */}
          {assignedGames.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                title="Remove Assigned"
                count={assignedGames.length}
                selectedCount={selectedAssignedGames.length}
                checkboxId="select-all-assigned"
                isChecked={selectedAssignedGames.length === assignedGames.length && assignedGames.length > 0}
                onToggle={handleSelectAllAssigned}
                badgeVariant="secondary"
              />

              <ScrollArea className="h-32 border rounded-md p-3">
                <div className="space-y-1">
                  {assignedGames.map((game) => (
                    <GameItem
                      key={game.id}
                      game={game}
                      isSelected={selectedAssignedGames.includes(game.id)}
                      onToggle={handleAssignedGameToggle}
                      prefix="assigned"
                      hoverClass="hover:bg-muted"
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Available Games Section */}
          <div className="space-y-3">
            <SectionHeader
              title="Assign Available"
              count={availableGames.length}
              selectedCount={selectedGames.length}
              checkboxId="select-all"
              isChecked={selectedGames.length === availableGames.length && availableGames.length > 0}
              onToggle={handleSelectAll}
              badgeVariant="secondary"
            />

            <ScrollArea className="h-32 border rounded-md p-3">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading games...</p>
                </div>
              ) : availableGames.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No available games for assignment</p>
                  <p className="text-xs mt-1">All multi-app games are already assigned to loaders. A game can only be assigned to one loader at a time.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {availableGames.map((game) => (
                    <GameItem
                      key={game.id}
                      game={game}
                      isSelected={selectedGames.includes(game.id)}
                      onToggle={handleGameToggle}
                      prefix="game"
                      hoverClass="hover:bg-muted"
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            {selectedAssignedGames.length > 0 && onUnassign && (
              <Button
                variant="destructive"
                onClick={handleUnassign}
                disabled={unassigning}
              >
                {unassigning ? 'Removing...' : `Remove ${selectedAssignedGames.length} Games`}
              </Button>
            )}
            {selectedGames.length > 0 && (
              <Button
                onClick={handleAssign}
                disabled={assigning}
              >
                {assigning ? 'Assigning...' : `Assign ${selectedGames.length} Games`}
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignGamesDialog;
