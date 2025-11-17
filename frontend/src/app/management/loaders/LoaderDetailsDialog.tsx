import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Zap, Calendar, Download, Users, Gamepad2, FileText, Bell } from 'lucide-react';
import type { Game } from '@/entities/game';
import type { Loader } from '@/entities/loader';

interface LoaderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loader: Loader | null;
  games: Game[];
}

const LoaderDetailsDialog: React.FC<LoaderDetailsDialogProps> = ({ open, onOpenChange, loader, games }) => {
  if (!loader) return null;

  const assignedGames = loader.assigned_games.map(gameId => 
    games.find(g => g.id === gameId)
  ).filter(Boolean) as Game[];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Maintenance</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            {loader.name}
          </DialogTitle>
          <DialogDescription>
            {loader.description || 'No description available'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Status</span>
              {getStatusBadge(loader.status)}
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Version</span>
              <span className="text-sm">v{loader.version}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Downloads</span>
              <span className="text-sm">{loader.downloads.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Active Users</span>
              <span className="text-sm">{loader.active_users.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Assigned Games</span>
              <span className="text-sm">{loader.assigned_games.length}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-muted-foreground">Creation Date</span>
              <span className="text-sm">
                {loader.created_at ? new Date(loader.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Assigned Games */}
          {assignedGames.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Assigned Games</h3>
              <div className="space-y-2">
                {assignedGames.map((game) => (
                  <div key={game.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                      {game.logo ? (
                        <img src={game.logo} alt={game.name} className="w-6 h-6 rounded" />
                      ) : (
                        <Gamepad2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{game.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Version: {game.version} | Status: {game.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Info */}
          {(loader.changelog || loader.notifications) && (
            <div className="space-y-3">
              {loader.changelog && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Changelog
                  </span>
                  <div className="mt-1 text-sm bg-muted p-3 rounded">{loader.changelog}</div>
                </div>
              )}
              
              {loader.notifications && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notifications
                  </span>
                  <div className="mt-1 text-sm bg-muted p-3 rounded">{loader.notifications}</div>
                </div>
              )}
            </div>
          )}

          {/* Last Update */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Last Updated
              </span>
              <span className="text-sm">
                {loader.updated_at ? new Date(loader.updated_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoaderDetailsDialog;