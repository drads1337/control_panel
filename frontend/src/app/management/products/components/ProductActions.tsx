import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Edit,
  Trash2,
  Upload,
  Bell,
  DollarSign,
  GitCommit,
  Eye,
} from 'lucide-react';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import type { Product } from '@/entities/product';

interface ProductActionsProps {
  product: Product;
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

export const ProductActions: React.FC<ProductActionsProps> = React.memo(({
  product,
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
  return (
    <div className="flex items-center gap-1">
      <ConditionalRender permission="products.view" fallback={null}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onViewProduct(product)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </ConditionalRender>
      
      {canEditProducts && (
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
      
      {canDeleteProducts && (
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
  );
});

ProductActions.displayName = 'ProductActions';

