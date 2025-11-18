import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
} from 'lucide-react';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import type { Game } from '@/entities/game';

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
  const getStatusBadge = (status: string) => {
    const statusType = status as StatusType;
    return (
      <span className={getStatusClasses(statusType)}>{getStatusText(statusType)}</span>
    );
  };

  const allSelected = selectedGames.length === games.length && games.length > 0;

  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = games.length > 50;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? games.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  const renderGameRow = (game: Game) => (
    <>
      <TableCell>
        <input
          type="checkbox"
          className="rounded border-gray-300"
          checked={selectedGames.includes(game.id)}
          onChange={() => onToggleGameSelection(game.id)}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">{game.name}</div>
            <div className="text-sm text-muted-foreground truncate max-w-xs">
              {game.description || 'No description provided'}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              ID: {game.unique_id}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">{getStatusBadge(game.status)}</TableCell>
      <TableCell className="text-center">
        <Badge
          variant={game.login_type === 'classic_login' ? 'default' : 'secondary'}
          className="font-medium"
        >
          {game.login_type === 'classic_login' ? 'Classic Login' : 'License Generation'}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="font-medium">
          v{game.version}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <div>
          <div className="font-semibold">{game.downloads.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">downloads</div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div>
          <div className="font-semibold">
            {(game.activeUsers || game.active_users || 0).toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">active users</div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center gap-1 justify-center">
          <ConditionalRender permission="games.view">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewGame(game)}
              title="View details"
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="games.edit">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditGame(game)}
              title="Edit Application"
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="games.upload_files">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUploadGame(game)}
              title="Upload files"
              className="h-8 w-8 p-0"
            >
              <Upload className="h-4 w-4" />
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="games.notifications_view">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNotificationsGame(game)}
              title="Manage notifications"
              className="h-8 w-8 p-0"
            >
              <Bell className="h-4 w-4" />
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="games.manage_prices">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPricesGame(game)}
              title="Manage prices"
              className="h-8 w-8 p-0"
            >
              <DollarSign className="h-4 w-4" />
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="games.changelog_view">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChangelogGame(game)}
              title="Manage changelog"
              className="h-8 w-8 p-0"
            >
              <GitCommit className="h-4 w-4" />
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="games.status">
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
          </ConditionalRender>
          <ConditionalRender permission="games.delete">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDeleteGame(game.id)}
              title="Delete application"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ConditionalRender>
        </div>
      </TableCell>
    </>
  );

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </TableHead>
            <TableHead className="font-semibold text-left">Application</TableHead>
            <TableHead className="font-semibold text-center">Status</TableHead>
            <TableHead className="font-semibold text-center">Login Type</TableHead>
            <TableHead className="font-semibold text-center">Version</TableHead>
            <TableHead className="font-semibold text-center">Downloads</TableHead>
            <TableHead className="font-semibold text-center">Users</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        {shouldVirtualize ? (
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
              <TableBody>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const game = games[virtualRow.index];
                  return (
                    <TableRow
                      key={game.id}
                      data-index={virtualRow.index}
                      className="hover:bg-muted/50 transition-colors"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {renderGameRow(game)}
                    </TableRow>
                  );
                })}
              </TableBody>
            </div>
          </div>
        ) : (
          <TableBody>
            {games.map((game) => (
              <TableRow key={game.id} className="hover:bg-muted/50 transition-colors">
                {renderGameRow(game)}
              </TableRow>
            ))}
          </TableBody>
        )}
      </Table>
    </div>
  );
};
