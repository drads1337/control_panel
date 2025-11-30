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
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      {canManageStatus && (
        <Select
          value={product.status}
          onValueChange={(value: 'active' | 'inactive' | 'maintenance' | 'testing') =>
            onStatusChange(product.id, value)
          }
        >
          <SelectTrigger className="w-[80px] h-7 text-xs border-0 bg-transparent hover:bg-accent px-2">
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <ConditionalRender permission="products.view" fallback={null}>
            <DropdownMenuItem onClick={() => onViewProduct(product)}>
              <Eye className="mr-2 h-4 w-4" /> View
            </DropdownMenuItem>
          </ConditionalRender>

          {canEditProducts && (
            <DropdownMenuItem onClick={() => onEditProduct(product)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
          )}

          {canUploadFiles && (
            <DropdownMenuItem onClick={() => onUploadProduct(product)}>
              <Upload className="mr-2 h-4 w-4" /> Files
            </DropdownMenuItem>
          )}

          {canManagePrices && (
            <DropdownMenuItem onClick={() => onPricesProduct(product)}>
              <DollarSign className="mr-2 h-4 w-4" /> Prices
            </DropdownMenuItem>
          )}

          {canManageNotifications && (
            <DropdownMenuItem onClick={() => onNotificationsProduct(product)}>
              <Bell className="mr-2 h-4 w-4" /> Notifications
            </DropdownMenuItem>
          )}

          {canManageChangelog && (
            <DropdownMenuItem onClick={() => onChangelogProduct(product)}>
              <GitCommit className="mr-2 h-4 w-4" /> Changelog
            </DropdownMenuItem>
          )}

          {canDeleteProducts && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDeleteProduct(product.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

ProductActions.displayName = 'ProductActions';