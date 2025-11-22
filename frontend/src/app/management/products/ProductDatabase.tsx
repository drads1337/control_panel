import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Plus, RefreshCw, Search, Check, X, Package } from 'lucide-react';
import { useProductQuery, useProductMutations, useProductSelection, useProductDialogs } from '@/hooks/products';
import { useProductPermissions as useProductPermissions } from '@/hooks/use-product-permissions';
import { useProductFilters as useProductFilters } from '@/hooks/use-product-filters';
import { useProductDialogStore } from '@/stores/product-dialog-store';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { BulkActionsPanel } from './BulkActionsPanel';
import { ProductsTable } from './ProductsTable';
import { ProductDatabaseEmptyState } from './ProductDatabaseEmptyState';
import { ProductDatabaseErrorState } from './ProductDatabaseErrorState';
import { ProductDatabaseAccessDenied } from './ProductDatabaseAccessDenied';
import { ProductDatabaseDialogs } from './ProductDatabaseDialogs';
import type { Product } from '@/entities/product';

interface ProductDatabaseProps {
  onViewProduct?: (product: Product) => void;
  onCreateProduct?: () => void;
  onCreateProductRequested?: boolean;
  onCreateProductRequestHandled?: () => void;
}

const ProductDatabase: React.FC<ProductDatabaseProps> = ({ 
  onCreateProductRequested,
  onCreateProductRequestHandled,
}) => {
  const {
    canViewProducts,
    canCreateProducts,
    canEditProducts,
    canDeleteProducts,
    canUploadFiles,
    canManagePrices,
    canManageChangelog,
    canManageNotifications,
    canManageStatus,
  } = useProductPermissions();

  // Use specialized hooks instead of God Hook
  const { products, loading, error, refetch } = useProductQuery();
  const { 
    handleStatusChange, 
    handleBulkStatusChange, 
    handleDeleteProduct, 
    handleBulkDelete 
  } = useProductMutations();
  const { 
    selectedProducts, 
    toggleProductSelection, 
    clearSelection,
    setSelectedProducts,
  } = useProductSelection(products);
  const {
    showCreateDialog,
    showPricesDialog,
    showNotificationsDialog,
    showUploadDialog,
    showEditDialog,
    showChangelogDialog,
    selectedProduct,
    openCreateDialog,
    openEditDialog,
    openUploadDialog,
    openNotificationsDialog,
    openPricesDialog,
    openChangelogDialog,
    closeAllDialogs,
    setShowCreateDialog,
    setShowEditDialog,
    setShowUploadDialog,
    setShowPricesDialog,
    setShowNotificationsDialog,
    setShowChangelogDialog,
  } = useProductDialogs();

  // Use store for view dialog
  const { openViewProductDialog } = useProductDialogStore();

  // Handle bulk actions
  const [bulkAction, setBulkAction] = useState<string>('');

  const handleBulkAction = async () => {
    if (!bulkAction || selectedProducts.length === 0) return;

    if (bulkAction === 'delete') {
      await handleBulkDelete(selectedProducts);
    } else {
      const status = bulkAction as 'active' | 'inactive' | 'maintenance' | 'testing';
      await handleBulkStatusChange(selectedProducts, status);
    }

    clearSelection();
    setBulkAction('');
  };

  // Handle view product - use store
  const handleViewProduct = (product: Product) => {
    openViewProductDialog(product);
  };

  // Handle other product actions
  const handleEditProduct = (product: Product) => {
    openEditDialog(product);
  };

  const handleUploadProduct = (product: Product) => {
    openUploadDialog(product);
  };

  const handleNotificationsProduct = (product: Product) => {
    openNotificationsDialog(product);
  };

  const handlePricesProduct = (product: Product) => {
    openPricesDialog(product);
  };

  const handleChangelogProduct = (product: Product) => {
    openChangelogDialog(product);
  };

  // Handle create dialog request from parent
  const onCreateRequested = onCreateProductRequested;
  const onCreateHandled = onCreateProductRequestHandled;

  useEffect(() => {
    if (onCreateRequested) {
      openCreateDialog();
      onCreateHandled?.();
    }
  }, [onCreateRequested, onCreateHandled, openCreateDialog]);

  const { filters, filteredProducts: filteredProducts, updateFilters, resetFilters } = useProductFilters(products);
  
  const allSelected = selectedProducts.length === filteredProducts.length && filteredProducts.length > 0;
  
  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  if (!canViewProducts) {
    return <ProductDatabaseAccessDenied />;
  }

  if (error) {
    return <ProductDatabaseErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-4">
      {}
      {!loading && filteredProducts.length === 0 && products.length === 0 ? (
        <ProductDatabaseEmptyState 
          onCreateProduct={() => setShowCreateDialog(true)}
          canCreateProducts={canCreateProducts}
        />
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Products</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={refetch}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <ConditionalRender permission="products.create" fallback={null}>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => setShowCreateDialog(true)}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </ConditionalRender>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={filters.searchTerm}
                  onChange={(e) => updateFilters({ searchTerm: e.target.value })}
                  className="pl-8"
                />
              </div>
              <Select 
                value={filters.status} 
                onValueChange={(value: 'all' | 'active' | 'inactive' | 'maintenance' | 'testing') =>
                  updateFilters({ status: value })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedProducts.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Selected: {selectedProducts.length} {selectedProducts.length === 1 ? 'product' : 'products'}
                  </span>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <ConditionalRender 
                    permissions={['products.status', 'products.delete']}
                    requireAll={false}
                    fallback={null}
                  >
                    <Select value={bulkAction} onValueChange={setBulkAction}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Action" />
                      </SelectTrigger>
                      <SelectContent>
                        <ConditionalRender permission="products.status" fallback={null}>
                          <SelectItem value="active">Activate</SelectItem>
                          <SelectItem value="inactive">Deactivate</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="testing">Testing</SelectItem>
                        </ConditionalRender>
                        <ConditionalRender permission="products.delete" fallback={null}>
                          <SelectItem value="delete">Delete</SelectItem>
                        </ConditionalRender>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleBulkAction} 
                      disabled={!bulkAction || (!canManageStatus && !canDeleteProducts)} 
                      size="sm"
                    >
                      Apply
                    </Button>
                  </ConditionalRender>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0 -mt-3">
            {loading ? (
              <Spinner message="Loading products..." />
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <div className="text-sm text-muted-foreground">No products found</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={filteredProducts.length === 0}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select All
                  </Button>
                </div>
                <ProductsTable
                  products={filteredProducts}
                  selectedProducts={selectedProducts}
                  onToggleProductSelection={toggleProductSelection}
                  onSelectAll={handleSelectAll}
                  onViewProduct={handleViewProduct}
                  onEditProduct={handleEditProduct}
                  onUploadProduct={handleUploadProduct}
                  onNotificationsProduct={handleNotificationsProduct}
                  onPricesProduct={handlePricesProduct}
                  onChangelogProduct={handleChangelogProduct}
                  onStatusChange={handleStatusChange}
                  onDeleteProduct={handleDeleteProduct}
                  canEditProducts={canEditProducts}
                  canDeleteProducts={canDeleteProducts}
                  canUploadFiles={canUploadFiles}
                  canManageNotifications={canManageNotifications}
                  canManagePrices={canManagePrices}
                  canManageChangelog={canManageChangelog}
                  canManageStatus={canManageStatus}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {}
      <ProductDatabaseDialogs
        showCreateDialog={showCreateDialog}
        showEditDialog={showEditDialog}
        showUploadDialog={showUploadDialog}
        showPricesDialog={showPricesDialog}
        showNotificationsDialog={showNotificationsDialog}
        showChangelogDialog={showChangelogDialog}
        selectedProduct={selectedProduct}
        canEditProducts={canEditProducts}
        canCreateProducts={canCreateProducts}
        canUploadFiles={canUploadFiles}
        canManagePrices={canManagePrices}
        canManageNotifications={canManageNotifications}
        canManageChangelog={canManageChangelog}
        setShowCreateDialog={setShowCreateDialog}
        setShowEditDialog={setShowEditDialog}
        setShowUploadDialog={setShowUploadDialog}
        setShowPricesDialog={setShowPricesDialog}
        setShowNotificationsDialog={setShowNotificationsDialog}
        setShowChangelogDialog={setShowChangelogDialog}
        closeAllDialogs={closeAllDialogs}
        onSuccess={() => {
          refetch();
        }}
        onUploadComplete={() => {
          refetch();
        }}
      />
    </div>
  );
};

export default ProductDatabase;