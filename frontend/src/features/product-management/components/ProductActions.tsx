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
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
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
    <div className="flex items-center justify-end gap-2">
      {/* Status Select - Always visible but shrinks on smaller screens */}
      {canManageStatus && (
        <Select
          value={product.status}
          onValueChange={(value: 'active' | 'inactive' | 'maintenance' | 'testing') =>
            onStatusChange(product.id, value)
          }
        >
          <SelectTrigger className="w-[100px] xl:w-28 h-8 text-xs">
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

      {/* Minimalistic: Only Edit visible, rest in dropdown */}
      {canEditProducts && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEditProduct(product)}
          title="Edit Product"
        >
          <Edit className="h-4 w-4" />
        </Button>
      )}

      {/* All other actions in dropdown menu */}
      <div className="flex">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <ConditionalRender permission="products.view" fallback={null}>
              <DropdownMenuItem onClick={() => onViewProduct(product)}>
                <Eye className="mr-2 h-4 w-4" /> View Details
              </DropdownMenuItem>
            </ConditionalRender>

            {canUploadFiles && (
              <DropdownMenuItem onClick={() => onUploadProduct(product)}>
                <Upload className="mr-2 h-4 w-4" /> Upload Files
              </DropdownMenuItem>
            )}

            {canManageNotifications && (
              <DropdownMenuItem onClick={() => onNotificationsProduct(product)}>
                <Bell className="mr-2 h-4 w-4" /> Notifications
              </DropdownMenuItem>
            )}

            {canManagePrices && (
              <DropdownMenuItem onClick={() => onPricesProduct(product)}>
                <DollarSign className="mr-2 h-4 w-4" /> Prices
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
    </div>
  );
});

ProductActions.displayName = 'ProductActions';

