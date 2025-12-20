import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Package, Check } from 'lucide-react';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { sanitizeString } from '@/lib/sanitization';
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
      "flex items-center justify-between p-3 border-b transition-colors",
      isSelected ? "bg-accent/40" : "hover:bg-accent/30"
    )}>
      <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
        <ProductSelectionCheckbox
          productId={product.id}
          isSelected={isSelected}
          onToggleSelection={onToggleSelection}
        />
        
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Package className="h-5 w-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm truncate max-w-[200px] sm:max-w-xs">
              {product.name}
            </h4>
            {isSelected && (
              <Check className="h-3 w-3 text-primary shrink-0" />
            )}
            <span className={cn("shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border", getStatusClasses(statusType))}>
              {getStatusText(statusType)}
            </span>
          </div>
          
          {product.description && (
            <p className="text-xs text-muted-foreground truncate mb-1.5 max-w-[300px] md:max-w-[400px]">
              {sanitizeString(product.description)}
            </p>
          )}
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {/* Version - Always visible */}
            <span className="font-medium text-foreground/80">v{product.version}</span>
            
            <span>•</span>
            
            {/* Type Badge - Always visible */}
            <Badge
              variant={product.login_type === 'classic_login' ? 'default' : 'secondary'}
              className="text-[10px] h-4 px-1.5 font-normal"
            >
              {product.login_type === 'classic_login' ? 'Classic' : 'License'}
            </Badge>

            {/* ID - Hidden on tablets, visible on large screens */}
            <span className="hidden xl:inline-flex items-center gap-2">
               <span>•</span>
               <span className="font-sans text-[10px] opacity-70">ID: {product.id}</span>
            </span>

            {/* Stats - Hidden on smaller laptops/tablets, visible on XL screens */}
            <span className="hidden 2xl:inline-flex items-center gap-2">
              <span>•</span>
              <span>{product.downloads.toLocaleString()} downloads</span>
              <span>•</span>
              <span>{(product.activeUsers || product.active_users || 0).toLocaleString()} users</span>
            </span>
          </div>
        </div>
      </div>
      
      {/* Actions Component - Handles its own responsiveness (Dropdown vs Icons) */}
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