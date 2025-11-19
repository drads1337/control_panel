import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Package,
  Edit,
  Trash2,
  Upload,
  Bell,
  DollarSign,
  GitCommit,
  Eye,
  Check,
} from 'lucide-react';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import type { Game } from '@/entities/game';

interface GameItemProps {
  game: Game;
  isSelected: boolean;
  onToggleSelection: (gameId: number) => void;
  onViewGame: (game: Game) => void;
  onEditGame: (game: Game) => void;
  onUploadGame: (game: Game) => void;
  onNotificationsGame: (game: Game) => void;
  onPricesGame: (game: Game) => void;
  onChangelogGame: (game: Game) => void;
  onStatusChange: (gameId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => void;
  onDeleteGame: (gameId: number) => void;
  canEditGames: boolean;
  canDeleteGames: boolean;
  canUploadFiles: boolean;
  canManageNotifications: boolean;
  canManagePrices: boolean;
  canManageChangelog: boolean;
  canManageStatus: boolean;
}

const GameItem = React.memo(({
  game,
  isSelected,
  onToggleSelection,
  onViewGame,
  onEditGame,
  onUploadGame,
  onNotificationsGame,
  onPricesGame,
  onChangelogGame,
  onStatusChange,
  onDeleteGame,
  canEditGames,
  canDeleteGames,
  canUploadFiles,
  canManageNotifications,
  canManagePrices,
  canManageChangelog,
  canManageStatus,
}: GameItemProps) => {
  const getStatusBadge = (status: string) => {
    const statusType = status as StatusType;
    return (
      <span className={getStatusClasses(statusType)}>{getStatusText(statusType)}</span>
    );
  };

  return (
    <div className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <input
          type="checkbox"
          className="rounded border-gray-300"
          checked={isSelected}
          onChange={() => onToggleSelection(game.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Package className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm truncate">{game.name}</h4>
            {isSelected && (
              <Check className="h-3 w-3 text-primary" />
            )}
            {getStatusBadge(game.status)}
          </div>
          {game.description && (
            <p className="text-xs text-muted-foreground truncate mb-1">
              {game.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="font-mono">ID: {game.unique_id}</span>
            <span>•</span>
            <span>v{game.version}</span>
            <span>•</span>
            <Badge
              variant={game.login_type === 'classic_login' ? 'default' : 'secondary'}
              className="text-xs h-4 px-1.5"
            >
              {game.login_type === 'classic_login' ? 'Classic' : 'License'}
            </Badge>
            <span>•</span>
            <span>{game.downloads.toLocaleString()} downloads</span>
            <span>•</span>
            <span>{(game.activeUsers || game.active_users || 0).toLocaleString()} users</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <ConditionalRender permission="games.view" fallback={null}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewGame(game)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </ConditionalRender>
        {canEditGames && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEditGame(game)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {canUploadFiles && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onUploadGame(game)}
          >
            <Upload className="h-4 w-4" />
          </Button>
        )}
        {canManageNotifications && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onNotificationsGame(game)}
          >
            <Bell className="h-4 w-4" />
          </Button>
        )}
        {canManagePrices && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPricesGame(game)}
          >
            <DollarSign className="h-4 w-4" />
          </Button>
        )}
        {canManageChangelog && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChangelogGame(game)}
          >
            <GitCommit className="h-4 w-4" />
          </Button>
        )}
        {canManageStatus && (
          <Select
            value={game.status}
            onValueChange={(value: 'active' | 'inactive' | 'maintenance' | 'testing') =>
              onStatusChange(game.id, value)
            }
          >
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="testing">Testing</SelectItem>
            </SelectContent>
          </Select>
        )}
        {canDeleteGames && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDeleteGame(game.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});

GameItem.displayName = 'GameItem';

interface GamesListProps {
  games: Game[];
  selectedGames: number[];
  onToggleGameSelection: (gameId: number) => void;
  onViewGame: (game: Game) => void;
  onEditGame: (game: Game) => void;
  onUploadGame: (game: Game) => void;
  onNotificationsGame: (game: Game) => void;
  onPricesGame: (game: Game) => void;
  onChangelogGame: (game: Game) => void;
  onStatusChange: (gameId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => void;
  onDeleteGame: (gameId: number) => void;
  canEditGames: boolean;
  canDeleteGames: boolean;
  canUploadFiles: boolean;
  canManageNotifications: boolean;
  canManagePrices: boolean;
  canManageChangelog: boolean;
  canManageStatus: boolean;
}

const GamesList: React.FC<GamesListProps> = ({
  games,
  selectedGames,
  onToggleGameSelection,
  onViewGame,
  onEditGame,
  onUploadGame,
  onNotificationsGame,
  onPricesGame,
  onChangelogGame,
  onStatusChange,
  onDeleteGame,
  canEditGames,
  canDeleteGames,
  canUploadFiles,
  canManageNotifications,
  canManagePrices,
  canManageChangelog,
  canManageStatus,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = games.length > 50;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? games.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  if (shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px', contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <div className="divide-y">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const game = games[virtualRow.index];
              return (
                <div
                  key={game.id}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <GameItem
                    game={game}
                    isSelected={selectedGames.includes(game.id)}
                    onToggleSelection={onToggleGameSelection}
                    onViewGame={onViewGame}
                    onEditGame={onEditGame}
                    onUploadGame={onUploadGame}
                    onNotificationsGame={onNotificationsGame}
                    onPricesGame={onPricesGame}
                    onChangelogGame={onChangelogGame}
                    onStatusChange={onStatusChange}
                    onDeleteGame={onDeleteGame}
                    canEditGames={canEditGames}
                    canDeleteGames={canDeleteGames}
                    canUploadFiles={canUploadFiles}
                    canManageNotifications={canManageNotifications}
                    canManagePrices={canManagePrices}
                    canManageChangelog={canManageChangelog}
                    canManageStatus={canManageStatus}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {games.map((game) => (
        <GameItem
          key={game.id}
          game={game}
          isSelected={selectedGames.includes(game.id)}
          onToggleSelection={onToggleGameSelection}
          onViewGame={onViewGame}
          onEditGame={onEditGame}
          onUploadGame={onUploadGame}
          onNotificationsGame={onNotificationsGame}
          onPricesGame={onPricesGame}
          onChangelogGame={onChangelogGame}
          onStatusChange={onStatusChange}
          onDeleteGame={onDeleteGame}
          canEditGames={canEditGames}
          canDeleteGames={canDeleteGames}
          canUploadFiles={canUploadFiles}
          canManageNotifications={canManageNotifications}
          canManagePrices={canManagePrices}
          canManageChangelog={canManageChangelog}
          canManageStatus={canManageStatus}
        />
      ))}
    </div>
  );
};

interface GamesTableProps {
  games: Game[];
  selectedGames: number[];
  onToggleGameSelection: (gameId: number) => void;
  onSelectAll: (selected: boolean) => void;
  onViewGame: (game: Game) => void;
  onEditGame: (game: Game) => void;
  onUploadGame: (game: Game) => void;
  onNotificationsGame: (game: Game) => void;
  onPricesGame: (game: Game) => void;
  onChangelogGame: (game: Game) => void;
  onStatusChange: (gameId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => void;
  onDeleteGame: (gameId: number) => void;
  canEditGames: boolean;
  canDeleteGames: boolean;
  canUploadFiles: boolean;
  canManageNotifications: boolean;
  canManagePrices: boolean;
  canManageChangelog: boolean;
  canManageStatus: boolean;
}

export const GamesTable: React.FC<GamesTableProps> = ({
  games,
  selectedGames,
  onToggleGameSelection,
  onSelectAll,
  onViewGame,
  onEditGame,
  onUploadGame,
  onNotificationsGame,
  onPricesGame,
  onChangelogGame,
  onStatusChange,
  onDeleteGame,
  canEditGames,
  canDeleteGames,
  canUploadFiles,
  canManageNotifications,
  canManagePrices,
  canManageChangelog,
  canManageStatus,
}) => {
  return (
    <GamesList
      games={games}
      selectedGames={selectedGames}
      onToggleGameSelection={onToggleGameSelection}
      onViewGame={onViewGame}
      onEditGame={onEditGame}
      onUploadGame={onUploadGame}
      onNotificationsGame={onNotificationsGame}
      onPricesGame={onPricesGame}
      onChangelogGame={onChangelogGame}
      onStatusChange={onStatusChange}
      onDeleteGame={onDeleteGame}
      canEditGames={canEditGames}
      canDeleteGames={canDeleteGames}
      canUploadFiles={canUploadFiles}
      canManageNotifications={canManageNotifications}
      canManagePrices={canManagePrices}
      canManageChangelog={canManageChangelog}
      canManageStatus={canManageStatus}
    />
  );
};
