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
import type { Game, Product } from '@/entities/game';  // Game is alias for Product

interface ProductItemProps {
  product: Product;  // Universal name
  // Backward compatibility alias
  game: Product;
  isSelected: boolean;
  onToggleSelection: (productId: number) => void;  // Universal name
  onViewProduct: (product: Product) => void;  // Universal name
  onEditProduct: (product: Product) => void;  // Universal name
  onUploadProduct: (product: Product) => void;  // Universal name
  onNotificationsProduct: (product: Product) => void;  // Universal name
  onPricesProduct: (product: Product) => void;  // Universal name
  onChangelogProduct: (product: Product) => void;  // Universal name
  onStatusChange: (productId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => void;  // Universal name
  onDeleteProduct: (productId: number) => void;  // Universal name
  // Backward compatibility aliases
  onViewGame: (game: Product) => void;
  onEditGame: (game: Product) => void;
  onUploadGame: (game: Product) => void;
  onNotificationsGame: (game: Product) => void;
  onPricesGame: (game: Product) => void;
  onChangelogGame: (game: Product) => void;
  onDeleteGame: (gameId: number) => void;
  canEditGames: boolean;
  canDeleteGames: boolean;
  canUploadFiles: boolean;
  canManageNotifications: boolean;
  canManagePrices: boolean;
  canManageChangelog: boolean;
  canManageStatus: boolean;
}

const ProductItem = React.memo(({
  product,
  // Backward compatibility - use product if game is not provided
  game = product,
  isSelected,
  onToggleSelection,
  onViewProduct,
  onEditProduct,
  onUploadProduct,
  onNotificationsProduct,
  onPricesProduct,
  onChangelogProduct,
  onStatusChange,
  onDeleteProduct,
  // Backward compatibility aliases
  onViewGame = onViewProduct,
  onEditGame = onEditProduct,
  onUploadGame = onUploadProduct,
  onNotificationsGame = onNotificationsProduct,
  onPricesGame = onPricesProduct,
  onChangelogGame = onChangelogProduct,
  onDeleteGame = onDeleteProduct,
  canEditGames,
  canDeleteGames,
  canUploadFiles,
  canManageNotifications,
  canManagePrices,
  canManageChangelog,
  canManageStatus,
}: ProductItemProps) => {
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
          onChange={() => onToggleSelection(product.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Package className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm truncate">{product.name}</h4>
            {isSelected && (
              <Check className="h-3 w-3 text-primary" />
            )}
            {getStatusBadge(product.status)}
          </div>
          {product.description && (
            <p className="text-xs text-muted-foreground truncate mb-1">
              {product.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="font-mono">ID: {product.unique_id}</span>
            <span>•</span>
            <span>v{product.version}</span>
            <span>•</span>
            <Badge
              variant={product.login_type === 'classic_login' ? 'default' : 'secondary'}
              className="text-xs h-4 px-1.5"
            >
              {product.login_type === 'classic_login' ? 'Classic' : 'License'}
            </Badge>
            <span>•</span>
            <span>{product.downloads.toLocaleString()} downloads</span>
            <span>•</span>
            <span>{(product.activeUsers || product.active_users || 0).toLocaleString()} users</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <ConditionalRender permission="games.view" fallback={null}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewProduct(product)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </ConditionalRender>
        {canEditGames && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEditProduct(product)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {canUploadFiles && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onUploadProduct(product)}
          >
            <Upload className="h-4 w-4" />
          </Button>
        )}
        {canManageNotifications && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onNotificationsProduct(product)}
          >
            <Bell className="h-4 w-4" />
          </Button>
        )}
        {canManagePrices && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPricesProduct(product)}
          >
            <DollarSign className="h-4 w-4" />
          </Button>
        )}
        {canManageChangelog && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChangelogProduct(product)}
          >
            <GitCommit className="h-4 w-4" />
          </Button>
        )}
        {canManageStatus && (
          <Select
            value={product.status}
            onValueChange={(value: 'active' | 'inactive' | 'maintenance' | 'testing') =>
              onStatusChange(product.id, value)
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
            onClick={() => onDeleteProduct(product.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});

ProductItem.displayName = 'ProductItem';
// Backward compatibility alias
export const GameItem = ProductItem;

interface ProductsListProps {
  products: Product[];  // Universal name
  selectedProducts: number[];  // Universal name
  onToggleProductSelection: (productId: number) => void;  // Universal name
  onViewProduct: (product: Product) => void;  // Universal name
  onEditProduct: (product: Product) => void;  // Universal name
  onUploadProduct: (product: Product) => void;  // Universal name
  onNotificationsProduct: (product: Product) => void;  // Universal name
  onPricesProduct: (product: Product) => void;  // Universal name
  onChangelogProduct: (product: Product) => void;  // Universal name
  onStatusChange: (productId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => void;  // Universal name
  onDeleteProduct: (productId: number) => void;  // Universal name
  // Backward compatibility aliases
  games: Product[];
  selectedGames: number[];
  onToggleGameSelection: (gameId: number) => void;
  onViewGame: (game: Product) => void;
  onEditGame: (game: Product) => void;
  onUploadGame: (game: Product) => void;
  onNotificationsGame: (game: Product) => void;
  onPricesGame: (game: Product) => void;
  onChangelogGame: (game: Product) => void;
  onDeleteGame: (gameId: number) => void;
  canEditGames: boolean;
  canDeleteGames: boolean;
  canUploadFiles: boolean;
  canManageNotifications: boolean;
  canManagePrices: boolean;
  canManageChangelog: boolean;
  canManageStatus: boolean;
}

const ProductsList: React.FC<ProductsListProps> = ({
  products,
  selectedProducts,
  onToggleProductSelection,
  onViewProduct,
  onEditProduct,
  onUploadProduct,
  onNotificationsProduct,
  onPricesProduct,
  onChangelogProduct,
  onStatusChange,
  onDeleteProduct,
  // Backward compatibility - destructure games and other props
  games = products,
  selectedGames = selectedProducts,
  onToggleGameSelection = onToggleProductSelection,
  onViewGame = onViewProduct,
  onEditGame = onEditProduct,
  onUploadGame = onUploadProduct,
  onNotificationsGame = onNotificationsProduct,
  onPricesGame = onPricesProduct,
  onChangelogGame = onChangelogProduct,
  onDeleteGame = onDeleteProduct,
  canEditGames,
  canDeleteGames,
  canUploadFiles,
  canManageNotifications,
  canManagePrices,
  canManageChangelog,
  canManageStatus,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = products.length > 50;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? products.length : 0,
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
              const product = products[virtualRow.index];
              return (
                <div
                  key={product.id}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ProductItem
                    product={product}
                    game={product}  // Backward compatibility
                    isSelected={selectedProducts.includes(product.id)}
                    onToggleSelection={onToggleProductSelection}
                    onViewProduct={onViewProduct}
                    onEditProduct={onEditProduct}
                    onUploadProduct={onUploadProduct}
                    onNotificationsProduct={onNotificationsProduct}
                    onPricesProduct={onPricesProduct}
                    onChangelogProduct={onChangelogProduct}
                    onStatusChange={onStatusChange}
                    onDeleteProduct={onDeleteProduct}
                    // Backward compatibility aliases
                    onViewGame={onViewProduct}
                    onEditGame={onEditProduct}
                    onUploadGame={onUploadProduct}
                    onNotificationsGame={onNotificationsProduct}
                    onPricesGame={onPricesProduct}
                    onChangelogGame={onChangelogProduct}
                    onDeleteGame={onDeleteProduct}
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
      {products.map((product) => (
        <ProductItem
          key={product.id}
          product={product}
          game={product}  // Backward compatibility
          isSelected={selectedProducts.includes(product.id)}
          onToggleSelection={onToggleProductSelection}
          onViewProduct={onViewProduct}
          onEditProduct={onEditProduct}
          onUploadProduct={onUploadProduct}
          onNotificationsProduct={onNotificationsProduct}
          onPricesProduct={onPricesProduct}
          onChangelogProduct={onChangelogProduct}
          onStatusChange={onStatusChange}
          onDeleteProduct={onDeleteProduct}
          // Backward compatibility aliases
          onViewGame={onViewProduct}
          onEditGame={onEditProduct}
          onUploadGame={onUploadProduct}
          onNotificationsGame={onNotificationsProduct}
          onPricesGame={onPricesProduct}
          onChangelogGame={onChangelogProduct}
          onDeleteGame={onDeleteProduct}
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

interface ProductsTableProps {
  products: Product[];  // Universal name
  selectedProducts: number[];  // Universal name
  onToggleProductSelection: (productId: number) => void;  // Universal name
  onSelectAll: (selected: boolean) => void;
  onViewProduct: (product: Product) => void;  // Universal name
  onEditProduct: (product: Product) => void;  // Universal name
  onUploadProduct: (product: Product) => void;  // Universal name
  onNotificationsProduct: (product: Product) => void;  // Universal name
  onPricesProduct: (product: Product) => void;  // Universal name
  onChangelogProduct: (product: Product) => void;  // Universal name
  onStatusChange: (productId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => void;  // Universal name
  onDeleteProduct: (productId: number) => void;  // Universal name
  // Backward compatibility aliases
  games: Product[];
  selectedGames: number[];
  onToggleGameSelection: (gameId: number) => void;
  onViewGame: (game: Product) => void;
  onEditGame: (game: Product) => void;
  onUploadGame: (game: Product) => void;
  onNotificationsGame: (game: Product) => void;
  onPricesGame: (game: Product) => void;
  onChangelogGame: (game: Product) => void;
  onDeleteGame: (gameId: number) => void;
  canEditGames: boolean;
  canDeleteGames: boolean;
  canUploadFiles: boolean;
  canManageNotifications: boolean;
  canManagePrices: boolean;
  canManageChangelog: boolean;
  canManageStatus: boolean;
}

export const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  selectedProducts,
  onToggleProductSelection,
  onSelectAll,
  onViewProduct,
  onEditProduct,
  onUploadProduct,
  onNotificationsProduct,
  onPricesProduct,
  onChangelogProduct,
  onStatusChange,
  onDeleteProduct,
  // Backward compatibility - destructure games and other props
  games = products,
  selectedGames = selectedProducts,
  onToggleGameSelection = onToggleProductSelection,
  onViewGame = onViewProduct,
  onEditGame = onEditProduct,
  onUploadGame = onUploadProduct,
  onNotificationsGame = onNotificationsProduct,
  onPricesGame = onPricesProduct,
  onChangelogGame = onChangelogProduct,
  onDeleteGame = onDeleteProduct,
  canEditGames,
  canDeleteGames,
  canUploadFiles,
  canManageNotifications,
  canManagePrices,
  canManageChangelog,
  canManageStatus,
}) => {
  return (
    <ProductsList
      products={products}
      selectedProducts={selectedProducts}
      onToggleProductSelection={onToggleProductSelection}
      onViewProduct={onViewProduct}
      onEditProduct={onEditProduct}
      onUploadProduct={onUploadProduct}
      onNotificationsProduct={onNotificationsProduct}
      onPricesProduct={onPricesProduct}
      onChangelogProduct={onChangelogProduct}
      onStatusChange={onStatusChange}
      onDeleteProduct={onDeleteProduct}
      // Backward compatibility aliases
      games={products}
      selectedGames={selectedProducts}
      onToggleGameSelection={onToggleProductSelection}
      onViewGame={onViewProduct}
      onEditGame={onEditProduct}
      onUploadGame={onUploadProduct}
      onNotificationsGame={onNotificationsProduct}
      onPricesGame={onPricesProduct}
      onChangelogGame={onChangelogProduct}
      onDeleteGame={onDeleteProduct}
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

// Backward compatibility aliases
export const GamesTable = ProductsTable;
const GamesList = ProductsList;
