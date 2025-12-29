import React from 'react';
import type { Product } from '@/entities/product';
import { ProductsList } from './ProductsList';

interface ProductsTableProps {
  products: Product[];
  selectedProducts: number[];
  onToggleProductSelection: (productId: number) => void;
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

export const ProductsTable: React.FC<ProductsTableProps> = ({
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
  canEditProducts,
  canDeleteProducts,
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
      canEditProducts={canEditProducts}
      canDeleteProducts={canDeleteProducts}
      canUploadFiles={canUploadFiles}
      canManageNotifications={canManageNotifications}
      canManagePrices={canManagePrices}
      canManageChangelog={canManageChangelog}
      canManageStatus={canManageStatus}
    />
  );
};



