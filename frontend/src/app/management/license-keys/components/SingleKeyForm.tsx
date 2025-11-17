import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Gamepad2, Container } from 'lucide-react';
import { useKeyForm } from '../hooks/use-key-form';
import { durationOptions, parseDuration } from '../hooks/use-duration';
import { ConditionalRender } from '@/components/rbac/conditional-render';
interface SingleKeyFormProps {
  games: Array<{ id: number; name: string; is_multi_app: boolean }>;
  loaders: Array<{ id: number; name: string; assigned_games: number[] }>;
  loadersLoading: boolean;
  onSubmit: (data: {
    targetType: 'game' | 'loader';
    gameId?: number;
    loaderId?: number;
    selectedGames?: number[];
    duration_hours: number;
    max_devices: number;
  }) => Promise<void>;
  loading: boolean;
  canViewGames: boolean;
  canViewLoaders: boolean;
}

export const SingleKeyForm: React.FC<SingleKeyFormProps> = ({
  games,
  loaders,
  loadersLoading,
  onSubmit,
  loading,
  canViewGames,
  canViewLoaders,
}) => {
  const showTargetTypeToggle = canViewGames && canViewLoaders;
  
  // Determine initial target type based on permissions
  // If user has both permissions, default to 'game'
  // If user has only games permission, force 'game'
  // If user has only loaders permission, force 'loader'
  const getInitialTargetType = () => {
    if (canViewGames && !canViewLoaders) return 'game';
    if (canViewLoaders && !canViewGames) return 'loader';
    return 'game'; // Default to game if both or neither
  };
  
  const {
    formData,
    updateField,
    getGameLibraryGames,
    getAssignedGamesForLoader,
    reset,
  } = useKeyForm({
    games,
    loaders,
    initialTargetType: getInitialTargetType(),
  });
  
  // Ensure targetType matches available permissions
  React.useEffect(() => {
    if (!showTargetTypeToggle) {
      // If user has games access but no loaders access, force game target type
      if (canViewGames && !canViewLoaders && formData.targetType !== 'game') {
        updateField('targetType', 'game');
      } 
      // If user has loaders access but no games access, force loader target type
      else if (canViewLoaders && !canViewGames && formData.targetType !== 'loader') {
        updateField('targetType', 'loader');
      }
      // If user has both but games exist, prefer game (unless targetType already set to loader)
      else if (canViewGames && canViewLoaders && games.length > 0 && formData.targetType === 'loader' && getGameLibraryGames().length > 0) {
        // Only switch to game if there are library games available
        // Otherwise keep loader if user has multi-app games
      }
    }
  }, [showTargetTypeToggle, canViewGames, canViewLoaders, formData.targetType, updateField, games, getGameLibraryGames]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const duration_hours = parseDuration(formData.duration, formData.customHours);
    
    if (formData.targetType === 'loader') {
      if (!formData.loaderId || formData.selectedGames.length === 0) {
        throw new Error('Please select a loader and at least one game');
      }
      // Create keys for each selected game
      const promises = formData.selectedGames.map(gameId =>
        onSubmit({
          targetType: 'loader',
          loaderId: parseInt(formData.loaderId),
          selectedGames: formData.selectedGames,
          duration_hours,
          max_devices: formData.maxDevices,
        })
      );
      await Promise.all(promises);
    } else {
      if (!formData.gameId) {
        throw new Error('Please select a game');
      }
      await onSubmit({
        targetType: 'game',
        gameId: parseInt(formData.gameId),
        duration_hours,
        max_devices: formData.maxDevices,
      });
    }
    
    reset();
  };

  return (
    <ConditionalRender permission="keys.create" fallback={null}>
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <CardTitle className="text-lg">Create License Key</CardTitle>
          </div>
          <CardDescription>Create a new license key for a game or loader.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 flex-grow">
          <form onSubmit={handleSubmit} className="space-y-4">
            {showTargetTypeToggle && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Target Type</Label>
                <ToggleGroup
                  type="single"
                  value={formData.targetType}
                  onValueChange={(value) => value && updateField('targetType', value as 'game' | 'loader')}
                  className="grid grid-cols-2 w-full"
                >
                  <ToggleGroupItem value="game" className="flex items-center justify-center gap-2 h-10 text-sm font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted hover:border-muted-foreground/20 transition-colors">
                    <Gamepad2 className="h-4 w-4" />
                    Game
                  </ToggleGroupItem>
                  <ToggleGroupItem value="loader" className="flex items-center justify-center gap-2 h-10 text-sm font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted hover:border-muted-foreground/20 transition-colors">
                    <Container className="h-4 w-4" />
                    Loader
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}

            {/* Show Game selector if: canViewGames AND (targetType is 'game' OR no loaders access) */}
            {canViewGames && (formData.targetType === 'game' || !canViewLoaders) ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Game</Label>
                {getGameLibraryGames().length === 0 ? (
                  games.length === 0 ? (
                    <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
                      <div className="text-center">
                        <Gamepad2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No games available. Create an application first.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
                      <div className="text-center">
                        <Gamepad2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">You only have access to multi-app games. Use Loader target type to create keys for them.</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex gap-2 items-center">
                    <Select
                      value={formData.gameId}
                      onValueChange={(value) => updateField('gameId', value)}
                      disabled={loading}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a game" />
                      </SelectTrigger>
                      <SelectContent>
                        {getGameLibraryGames().map((game) => (
                          <SelectItem key={game.id} value={game.id.toString()}>
                            {game.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateField('gameId', '')}
                      disabled={loading}
                      className="h-10 w-10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
            
            {/* Show Loader selector if: canViewLoaders AND (targetType is 'loader' OR no games access) */}
            {canViewLoaders && (formData.targetType === 'loader' || !canViewGames) ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Loader</Label>
                  {loaders.length === 0 ? (
                    <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
                      <div className="text-center">
                        <Container className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No loaders available. Create a loader first.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <Select
                        value={formData.loaderId}
                        onValueChange={(value) => {
                          updateField('loaderId', value);
                          updateField('selectedGames', []);
                        }}
                        disabled={loading || loadersLoading}
                      >
                      <SelectTrigger className="flex-1">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        updateField('loaderId', '');
                        updateField('selectedGames', []);
                      }}
                      disabled={loading}
                      className="h-10 w-10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  )}

                {formData.loaderId && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Select Games</Label>
                    {getAssignedGamesForLoader(parseInt(formData.loaderId)).length === 0 ? (
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
                            id="select-all-games"
                            checked={formData.selectedGames.length === getAssignedGamesForLoader(parseInt(formData.loaderId)).length && getAssignedGamesForLoader(parseInt(formData.loaderId)).length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const allGameIds = getAssignedGamesForLoader(parseInt(formData.loaderId)).map(game => game.id);
                                updateField('selectedGames', allGameIds);
                              } else {
                                updateField('selectedGames', []);
                              }
                            }}
                          />
                          <Label htmlFor="select-all-games" className="text-sm font-medium">All Games</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                          {getAssignedGamesForLoader(parseInt(formData.loaderId)).map(game => (
                            <div key={game.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`game-${game.id}`}
                                checked={formData.selectedGames.includes(game.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    updateField('selectedGames', [...formData.selectedGames, game.id]);
                                  } else {
                                    updateField('selectedGames', formData.selectedGames.filter(id => id !== game.id));
                                  }
                                }}
                              />
                              <Label htmlFor={`game-${game.id}`} className="text-sm font-normal">{game.name}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Duration</Label>
              <div className="grid grid-cols-5 gap-2">
                {durationOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.duration === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      updateField('duration', option.value);
                      updateField('customHours', '');
                    }}
                    disabled={loading}
                    className="text-xs"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Or Custom Hours</Label>
                <Input
                  type="number"
                  placeholder="e.g., 48"
                  value={formData.customHours}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateField('customHours', value);
                    if (value) {
                      updateField('duration', '');
                    }
                  }}
                  disabled={loading}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Max. Devices</Label>
                <Input
                  type="number"
                  value={formData.maxDevices}
                  onChange={(e) => updateField('maxDevices', parseInt(e.target.value) || 1)}
                  disabled={loading}
                  min="1"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={loading || (formData.targetType === 'game' ? !formData.gameId : !formData.loaderId || formData.selectedGames.length === 0)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {loading ? 'Generating...' : 'Generate License Key'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </ConditionalRender>
  );
};
