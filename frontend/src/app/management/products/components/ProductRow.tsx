import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Package, Check } from 'lucide-react';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import type { Product } from '@/entities/product';
import { ProductSelectionCheckbox } from './ProductSelectionCheckbox';
import { ProductActions } from './ProductActions';

interface ProductRowProps {
  product: Product;
  isSelected: boolean;
  onToggleSelection: (productId: number) => void;
  onViewProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onUploadProduct: (product: Product) => void;
  onNotificationsProduct: (product: Product) => void;
  onPricesProduct: (product: Product) => void;
  onChangelogProduct: (product: Product) => void;
  onStatusChange: (productId: number, newStatus: 'active' | 'inactive' | 'maintenance' | 'testing') => void;
  onDeleteProduct: (productId: number) => void;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canUploadFiles: boolean;
  canManageNotifications: boolean;
  canManagePrices: boolean;
  canManageChangelog: boolean;
  canManageStatus: boolean;
}

export const ProductRow: React.FC<ProductRowProps> = React.memo(({
  product,
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
  canEditProducts,
  canDeleteProducts,
  canUploadFiles,
  canManageNotifications,
  canManagePrices,
  canManageChangelog,
  canManageStatus,
}) => {
  const statusType = product.status as StatusType;

  return (
    <div className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ProductSelectionCheckbox
          productId={product.id}
          isSelected={isSelected}
          onToggleSelection={onToggleSelection}
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
            <span className={getStatusClasses(statusType)}>
              {getStatusText(statusType)}
            </span>
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
      
      <ProductActions
        product={product}
        onViewProduct={onViewProduct}
        onEditProduct={onEditProduct}
        onUploadProduct={onUploadProduct}
        onNotificationsProduct={onNotificationsProduct}
        onPricesProduct={onPricesProduct}
        onChangelogProduct={onChangelogProduct}
        onStatusChange={onStatusChange}
        onDeleteProduct={onDeleteProduct}
        canEditProducts={canEditProducts}
        canDeleteProducts={canDeleteProducts}
        canUploadFiles={canUploadFiles}
        canManageNotifications={canManageNotifications}
        canManagePrices={canManagePrices}
        canManageChangelog={canManageChangelog}
        canManageStatus={canManageStatus}
      />
    </div>
  );
});

ProductRow.displayName = 'ProductRow';

