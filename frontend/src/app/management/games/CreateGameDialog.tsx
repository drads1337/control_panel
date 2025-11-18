import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, Plus, FileText, Globe, GitCommit
} from 'lucide-react';
import { createGame } from '@/entities/game';
import { createFolder } from '@/entities/file';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { getErrorMessage } from '@/shared/api/enhanced-client';

interface CreateGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateGameDialog: React.FC<CreateGameDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('games.create');

  if (!canCreate) {
    return null;
  }

  const [creatingGame, setCreatingGame] = useState(false);
  const [createGameData, setCreateGameData] = useState<{
    name: string;
    description: string;
    is_multi_app: boolean;
    version: string;
  }>({
    name: '',
    description: '',
    is_multi_app: false,
    version: '1.0.0'
  });

  const handleCreateGame = async () => {
    if (!createGameData.name.trim()) {
      toast.error('Application name is required.');
      return;
    }

    try {
      setCreatingGame(true);

      const gameData = {
        name: createGameData.name.trim(),
        description: createGameData.description.trim() || undefined,
        is_multi_app: createGameData.is_multi_app,
        version: createGameData.version.trim() || '1.0.0'
      }

      const response = await createGame(gameData);

      if (response.success && response.game) {
        try {
          await createFolder({
            name: 'configs',
            parent_path: '/',
            game_id: response.game.id
          });

        } catch (folderError) {

        }
      }

      if (response.success && response.game) {

        toast.success('Game successfully created!');
        onOpenChange(false);
        setCreateGameData({
          name: '',
          description: '',
          is_multi_app: false,
          version: '1.0.0'
        });
        onSuccess();
      } else {
        toast.error(response.message || 'Failed to create game.');

      }
    } catch (err: unknown) {

      if (import.meta.env.DEV) {

        if (err && typeof err === 'object' && 'debug' in err) {
          const debugInfo = (err as any).debug

        }
      }

      const errorMessage = getErrorMessage(err)
      toast.error(errorMessage)
    } finally {

      setCreatingGame(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setCreateGameData({
      name: '',
      description: '',
      is_multi_app: false,
      version: '1.0.0'
    });
  };

  if (!canCreate) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Application</DialogTitle>
          <DialogDescription>
            Fill in the details for the new game.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gameName">Application Name *</Label>
            <Input 
              id="gameName" 
              placeholder="Enter game name"
              value={createGameData.name}
              onChange={(e) => setCreateGameData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gameDescription">Description</Label>
            <Input 
              id="gameDescription" 
              placeholder="Enter game description (optional)"
              value={createGameData.description}
              onChange={(e) => setCreateGameData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gameType">Game Type</Label>
            <Select 
              value={createGameData.is_multi_app ? 'multi_app' : 'game_library'}
              onValueChange={(value) => setCreateGameData(prev => ({ 
                ...prev, 
                is_multi_app: value === 'multi_app' 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select game type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="game_library">Application Library</SelectItem>
                <SelectItem value="multi_app">Multi-App</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gameVersion">Version</Label>
            <Input 
              id="gameVersion" 
              placeholder="1.0.0" 
              value={createGameData.version}
              onChange={(e) => setCreateGameData(prev => ({ ...prev, version: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={creatingGame}
          >
            Cancel
          </Button>
          <ConditionalRender permission="games.create" fallback={null}>
            <Button 
              onClick={handleCreateGame}
              disabled={creatingGame || !createGameData.name.trim()}
            >
              {creatingGame ? 'Creating...' : 'Create Application'}
            </Button>
          </ConditionalRender>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGameDialog;