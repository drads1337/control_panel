import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Edit, Upload } from 'lucide-react';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { useGamePermissions } from '@/hooks/use-game-permissions';
import type { Game } from '@/entities/game';

interface ViewGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game | null;
  onEdit: (game: Game) => void;
  onUpload: (game: Game) => void;
}

const ViewGameDialog: React.FC<ViewGameDialogProps> = ({
  open,
  onOpenChange,
  game,
  onEdit,
  onUpload,
}) => {
  const { canViewGames } = useGamePermissions();

  if (!game || !canViewGames) return null;

  const getStatusBadge = (status: string) => {
    const statusType = status as StatusType;
    return (
      <span className={getStatusClasses(statusType)}>
        {getStatusText(statusType)}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            {game.name}
          </DialogTitle>
          <DialogDescription>
            {game.description || 'No description'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Version</span>
              <span className="text-sm">{game.version}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Type</span>
              <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium">
                {game.is_multi_app ? 'Multi-App' : 'Application Library'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Login Type</span>
              <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium">
                {game.login_type === 'classic_login' ? 'Classic Login' : 'License Generation'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Status</span>
              {getStatusBadge(game.status)}
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Downloads</span>
              <span className="text-sm">{game.downloads.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Active Users</span>
              <span className="text-sm">{(game.activeUsers || game.active_users || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-muted-foreground">Date Created</span>
              <span className="text-sm">
                {game.created_at ? new Date(game.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">ID: {game.id}</span>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ViewGameDialog;