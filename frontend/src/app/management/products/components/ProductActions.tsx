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
  DropdownMenuLabel,
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

      {/* DESKTOP VIEW (XL screens): Show full row of icons */}
      <div className="hidden xl:flex items-center gap-1">
        <ConditionalRender permission="products.view" fallback={null}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewProduct(product)}
            title="View Details"
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
            title="Edit Product"
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
            title="Upload Files"
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
            title="Notifications"
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
            title="Manage Prices"
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
            title="Changelog"
          >
            <GitCommit className="h-4 w-4" />
          </Button>
        )}
        
        {canDeleteProducts && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDeleteProduct(product.id)}
            title="Delete Product"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* TABLET/COMPACT VIEW (< XL screens): Show Dropdown Menu */}
      <div className="flex xl:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            
            <ConditionalRender permission="products.view" fallback={null}>
              <DropdownMenuItem onClick={() => onViewProduct(product)}>
                <Eye className="mr-2 h-4 w-4" /> View Details
              </DropdownMenuItem>
            </ConditionalRender>

            {canEditProducts && (
              <DropdownMenuItem onClick={() => onEditProduct(product)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

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

            {(canDeleteProducts) && <DropdownMenuSeparator />}
            
            {canDeleteProducts && (
              <DropdownMenuItem 
                onClick={() => onDeleteProduct(product.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

ProductActions.displayName = 'ProductActions';