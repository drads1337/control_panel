import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { getGames } from '@/entities/game';
import type { Game } from '@/entities/game';
import { enhancedApi } from '@/shared/api/enhanced-client';
import { 
  Coins, 
  Save, 
  RefreshCw, 
  Edit2, 
  Trash2,
  X,
  Plus
} from 'lucide-react';

interface GamePrice {
  period: string;
  price: number;
}

interface GameData {
  id: number;
  name: string;
  is_multi_app: boolean;
}

interface PriceManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameId?: number;
}

const PriceManager: React.FC<PriceManagerProps> = ({ open, onOpenChange, gameId }) => {
  const { user, token } = useAuth();
  const { hasPermission } = usePermissions();
  
  const canEditGames = hasPermission('games.edit');

  const [game, setGame] = useState<GameData | null>(null);
  const [prices, setPrices] = useState<GamePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPrices, setEditingPrices] = useState<{[key: string]: number}>({});

  const commonDurations = [
    { value: '1', label: '1 hour' },
    { value: '12', label: '12 hours' },
    { value: '24', label: '1 day' },
    { value: '72', label: '3 days' },
    { value: '168', label: '1 week' },
    { value: '336', label: '2 weeks' },
    { value: '720', label: '1 month' },
    { value: '2160', label: '3 months' },
    { value: '4320', label: '6 months' },
    { value: '8760', label: '1 year' },
  ];

  useEffect(() => {
    if (open && gameId && token) {
      loadGameData();
    }
  }, [open, gameId, token]);

  const loadGameData = async () => {
    if (!gameId || !token) return;
    
    try {
      setLoading(true);
      
      const gamesResponse = await getGames('all');
      const foundGame = gamesResponse.games.find(g => g.id === gameId);
      
      if (!foundGame) {
        throw new Error('Game not found');
      }
      
      setGame(foundGame);

      // Use enhancedApi instead of fetch - CSRF and credentials are handled automatically
      const pricesResponse = await enhancedApi.get(`/api/games/${gameId}/prices`);
      const pricesData = pricesResponse.data;
      console.log('Prices data received:', pricesData);
      
      const pricesArray = Object.entries(pricesData.prices || {}).map(([period, price]) => ({
        period,
        price: price as number
      }));
      setPrices(pricesArray);
      
      const editingState: {[key: string]: number} = {};
      pricesArray.forEach(price => {
        editingState[price.period] = price.price;
      });
      setEditingPrices(editingState);
    } catch (error: any) {
      console.error('Error loading game data:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to load prices';
      toast.warning(`Failed to load prices: ${errorMessage}. Using an empty state.`);
      setPrices([]);
      setEditingPrices({});
    } finally {
      setLoading(false);
    }
  };
  
  const handlePriceChange = (period: string, value: string) => {
    // Allow only numbers, a dot, and an empty string
    const cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Check that the dot is not repeated
    const dotCount = (cleanValue.match(/\./g) || []).length;
    if (dotCount > 1) return;
    
    // Check for no more than 2 digits after the dot
    if (cleanValue.includes('.')) {
      const parts = cleanValue.split('.');
      if (parts[1] && parts[1].length > 2) return;
    }
    
    const numValue = cleanValue === '' ? 0 : Math.max(0, parseFloat(cleanValue) || 0);
    setEditingPrices(prev => ({
      ...prev,
      [period]: numValue
    }));
  };

  const handleSavePrices = async () => {
    if (!gameId || !token) return;

    const hasValidPrices = Object.values(editingPrices).some(price => price > 0);
    if (!hasValidPrices) {
      toast.warning('Set at least one price greater than 0');
      return;
    }

    try {
      setSaving(true);
      
      // Use enhancedApi instead of fetch - CSRF and credentials are handled automatically
      await enhancedApi.put(`/api/games/${gameId}/prices`, {
        prices: editingPrices
      });

      toast.success('Prices saved successfully');

      loadGameData();
    } catch (error: any) {
      console.error('Error saving prices:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to save prices';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPeriod = (period: string) => {
    if (!editingPrices[period]) {
      setEditingPrices(prev => ({
        ...prev,
        [period]: 0
      }));
    }
  };

  const handleRemovePeriod = (period: string) => {
    setEditingPrices(prev => {
      const newPrices = { ...prev };
      delete newPrices[period];
      return newPrices;
    });
  };

  const getPeriodLabel = (period: string) => {
    const duration = commonDurations.find(d => d.value === period);
    return duration ? duration.label : period;
  };

  if (!canEditGames) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Access Denied
            </DialogTitle>
            <DialogDescription>
              You don't have permission to manage prices.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <Spinner message="Loading..." />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Price Management
          </DialogTitle>
          <DialogDescription>
            {game ? `Configure prices for the game "${game.name}"` : 'Configure prices for the game'}
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardHeader>
            <CardTitle>Prices in Tokens</CardTitle>
            <CardDescription>
              Set prices for different access periods.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {commonDurations.map(duration => (
                <div key={duration.value} className="flex flex-col gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-sm">
                      {duration.label}
                    </Label>
                    {editingPrices[duration.value] !== undefined && (
                      <ConditionalRender permission="games.edit" fallback={null}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePeriod(duration.value)}
                          className="text-destructive hover:text-destructive h-6 w-6 p-0"
                          disabled={saving || !canEditGames}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </ConditionalRender>
                    )}
                  </div>
                  
                  {editingPrices[duration.value] !== undefined ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="0"
                        value={editingPrices[duration.value] !== undefined ? editingPrices[duration.value].toString() : ''}
                        onChange={(e) => handlePriceChange(duration.value, e.target.value)}
                        className="flex-1"
                        disabled={saving || !canEditGames}
                        inputMode="decimal"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">tokens</span>
                    </div>
                  ) : (
                    <ConditionalRender permission="games.edit" fallback={null}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddPeriod(duration.value)}
                        className="flex items-center gap-1 w-full"
                        disabled={saving || !canEditGames}
                      >
                        <Plus className="h-3 w-3" />
                        Add Price
                      </Button>
                    </ConditionalRender>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <ConditionalRender permission="games.edit" fallback={null}>
              <Button
                onClick={handleSavePrices}
                disabled={saving || !canEditGames}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Saving...' : 'Save Prices'}
              </Button>
            </ConditionalRender>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default PriceManager;