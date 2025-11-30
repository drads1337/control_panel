import React from 'react';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import type { Product } from '@/entities/product';
import { ProductSelectionCheckbox } from './ProductSelectionCheckbox';
import { ProductActions } from './ProductActions';
import { cn } from '@/lib/utils';

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
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 border-b transition-colors group",
      isSelected ? "bg-accent/20" : "hover:bg-accent/5"
    )}>
      <ProductSelectionCheckbox
        productId={product.id}
        isSelected={isSelected}
        onToggleSelection={onToggleSelection}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h4 className="font-medium text-sm truncate">
            {product.name}
          </h4>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", getStatusClasses(statusType))}>
            {getStatusText(statusType)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
          <span>v{product.version}</span>
          <span className="opacity-40">•</span>
          <span className="font-mono opacity-70">{product.id}</span>
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