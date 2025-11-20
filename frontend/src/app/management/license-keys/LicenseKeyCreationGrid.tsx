import React, { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthContext } from '@/contexts/auth-context';
import { enhancedApi } from '@/shared/api/enhanced-client';
import { toast } from 'sonner';
import { createLicenseKey, createCustomLicenseKey, bulkCreateLicenseKeys } from '@/entities/key';
import { getLoaders } from '@/entities/loader';
import { SingleKeyForm } from './components/SingleKeyForm';
import { CustomKeyForm } from './components/CustomKeyForm';
import { BulkKeyForm } from './components/BulkKeyForm';
import { BulkKeyOperationsForm } from './components/BulkKeyOperationsForm';

interface LicenseKeyCreationGridProps {
  games: Array<{ id: number; name: string; is_multi_app: boolean }>;
  onKeyCreated: (createdKeyId?: number) => void;
}

const LicenseKeyCreationGrid: React.FC<LicenseKeyCreationGridProps> = ({ games, onKeyCreated }) => {
  const { hasPermission } = usePermissions();
  const { user } = useAuthContext();
  const canCreate = hasPermission('keys.create');
  const canGenerate = hasPermission('keys.generate');

  const [loading, setLoading] = useState({
    single: false,
    custom: false,
    bulk: false,
  });

  const [loaders, setLoaders] = useState<Array<{ id: number; name: string; assigned_games: number[] }>>([]);
  const [loadersLoading, setLoadersLoading] = useState(false);

  const [userGameAccess, setUserGameAccess] = useState<number[]>([]);
  const [gameAccessLoading, setGameAccessLoading] = useState(false);

  const loadUserGameAccess = async () => {
    if (!user?.id) return;

    try {
      setGameAccessLoading(true);
      // Use universal endpoint - products instead of games
      const response = await enhancedApi.get(`/api/clients/${user.id}/products`);
      if (Array.isArray(response.data)) {

        const accessibleGames = response.data
          .filter((game: any) => game.has_access === true)
          .map((game: any) => game.game_id || game.id);
        setUserGameAccess(accessibleGames);
      }
    } catch (error: any) {

      setUserGameAccess([]);
    } finally {
      setGameAccessLoading(false);
    }
  };

  const gameLibraryGames = games.filter(game => !game.is_multi_app);
  const canViewGames = gameLibraryGames.length > 0;

  const multiAppGames = games.filter(game => game.is_multi_app);
  const canViewLoaders = multiAppGames.length > 0;

  useEffect(() => {
    loadLoaders();
    loadUserGameAccess();
  }, [user?.id, games.length]);

  const loadLoaders = async () => {
    try {
      setLoadersLoading(true);
      const response = await getLoaders();
      if (response.success) {
        setLoaders(response.loaders.map(loader => ({
          id: loader.id,
          name: loader.name,
          assigned_games: loader.assigned_games || []
        })));
      }
    } catch (error) {

      toast.error('Error loading loaders');
    } finally {
      setLoadersLoading(false);
    }
  };

  const handleSingleKeySubmit = async (data: {
    targetType: 'game' | 'loader';
    gameId?: number;
    loaderId?: number;
    selectedGames?: number[];
    duration_hours: number;
    max_devices: number;
  }) => {
    if (!canCreate && !canGenerate) {
      toast.error('You do not have permission to create keys');
      return;
    }

    setLoading(prev => ({ ...prev, single: true }));

    try {
      if (data.targetType === 'loader') {
        if (!data.loaderId || !data.selectedGames || data.selectedGames.length === 0) {
          throw new Error('Please select a loader and at least one game');
        }

        const promises = data.selectedGames.map(gameId =>
          createLicenseKey({
            game_id: gameId,
            duration_hours: data.duration_hours,
            max_devices: data.max_devices
          })
        );

        const results = await Promise.all(promises);
        toast.success(`${data.selectedGames.length} license keys created successfully!`);

        const firstKeyId = results[0]?.key?.id;
        onKeyCreated(firstKeyId);
      } else {
        if (!data.gameId) {
          throw new Error('Please select a game');
        }

        const result = await createLicenseKey({
          game_id: data.gameId,
          duration_hours: data.duration_hours,
          max_devices: data.max_devices
        });
        toast.success(result.message || 'License key created successfully!');
        onKeyCreated(result.key?.id);
      }
    } catch (error) {

      toast.error(error instanceof Error ? error.message : 'Error creating license key');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, single: false }));
    }
  };

  const handleCustomKeySubmit = async (data: {
    targetType: 'game' | 'loader';
    gameId?: number;
    loaderId?: number;
    selectedGames?: number[];
    keyName: string;
    duration_hours: number;
    max_devices: number;
  }) => {
    if (!canCreate && !canGenerate) {
      toast.error('You do not have permission to create keys');
      return;
    }

    setLoading(prev => ({ ...prev, custom: true }));

    try {
      if (data.targetType === 'loader') {
        if (!data.loaderId || !data.selectedGames || data.selectedGames.length === 0) {
          throw new Error('Please select a loader and at least one game');
        }

        const promises = data.selectedGames.map(gameId =>
          createCustomLicenseKey({
            game_id: gameId,
            duration_hours: data.duration_hours,
            max_devices: data.max_devices,
            custom_key: `${data.keyName}-${Date.now()}-${gameId}`
          })
        );

        await Promise.all(promises);
        toast.success(`${data.selectedGames.length} custom license keys created successfully!`);
      } else {
        if (!data.gameId) {
          throw new Error('Please select a game');
        }

        const result = await createCustomLicenseKey({
          game_id: data.gameId,
          duration_hours: data.duration_hours,
          max_devices: data.max_devices,
          custom_key: data.keyName || `CUSTOM-${Date.now()}`
        });
        toast.success(result.message || 'Custom key created successfully!');
      }

      onKeyCreated();
    } catch (error) {

      toast.error(error instanceof Error ? error.message : 'Error creating custom key');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, custom: false }));
    }
  };

  const handleBulkKeySubmit = async (data: {
    targetType: 'game' | 'loader';
    gameId?: number;
    loaderId?: number;
    selectedGames?: number[];
    quantity: number;
    duration_hours: number;
    max_devices: number;
  }) => {
    if (!canCreate && !canGenerate) {
      toast.error('You do not have permission to create keys');
      return;
    }

    setLoading(prev => ({ ...prev, bulk: true }));

    try {
      if (data.targetType === 'loader') {
        if (!data.loaderId || !data.selectedGames || data.selectedGames.length === 0) {
          throw new Error('Please select a loader and at least one game');
        }

        const promises = data.selectedGames.map(gameId =>
          bulkCreateLicenseKeys({
            game_id: gameId,
            count: data.quantity,
            duration_hours: data.duration_hours,
            max_devices: data.max_devices
          })
        );

        await Promise.all(promises);
        toast.success(`${data.quantity * data.selectedGames.length} keys created successfully!`);
        onKeyCreated();
      } else {
        if (!data.gameId) {
          throw new Error('Please select a game');
        }

        const result = await bulkCreateLicenseKeys({
          game_id: data.gameId,
          count: data.quantity,
          duration_hours: data.duration_hours,
          max_devices: data.max_devices
        });
        toast.success(result.message || `${data.quantity} keys created successfully!`);
        onKeyCreated();
      }
    } catch (error) {

      toast.error(error instanceof Error ? error.message : 'Error creating bulk keys');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, bulk: false }));
    }
  };

  if (games.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">No Applications Available</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                Create your first application to start generating license keys. You can create both regular applications and multi-app applications.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canCreate && !canGenerate) {
    return null;
  }

  return (
    <div className="space-y-6">
      {}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {}
        <SingleKeyForm
          games={games}
          loaders={loaders}
          loadersLoading={loadersLoading}
          onSubmit={handleSingleKeySubmit}
          loading={loading.single}
          canViewGames={canViewGames}
          canViewLoaders={canViewLoaders}
        />

        {}
        <CustomKeyForm
          games={games}
          loaders={loaders}
          loadersLoading={loadersLoading}
          onSubmit={handleCustomKeySubmit}
          loading={loading.custom}
          canViewGames={canViewGames}
          canViewLoaders={canViewLoaders}
        />

        {}
        <BulkKeyForm
          games={games}
          loaders={loaders}
          loadersLoading={loadersLoading}
          onSubmit={handleBulkKeySubmit}
          loading={loading.bulk}
          canViewGames={canViewGames}
          canViewLoaders={canViewLoaders}
        />

        {}
        <BulkKeyOperationsForm
          games={games}
          loaders={loaders}
          loadersLoading={loadersLoading}
          onOperationComplete={onKeyCreated}
          canViewGames={canViewGames}
          canViewLoaders={canViewLoaders}
        />
      </div>
    </div>
  );
};

export default LicenseKeyCreationGrid;
