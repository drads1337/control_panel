import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Search, Check, X, Package, MoreVertical, Edit, Upload, Bell, DollarSign, FileText, Trash2, Eye } from 'lucide-react';
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
import { ProductsTable } from './ProductsTable';
import { ProductDatabaseEmptyState } from './ProductDatabaseEmptyState';
import { ProductDatabaseErrorState } from './ProductDatabaseErrorState';
import { ProductDatabaseAccessDenied } from './ProductDatabaseAccessDenied';
import { ProductDatabaseDialogs } from './ProductDatabaseDialogs';
import type { Product } from '@/entities/product';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';

// Хук для определения размера экрана
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

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
  const isMobile = useMediaQuery('(max-width: 768px)');

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

  const { openViewProductDialog } = useProductDialogStore();

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

  const handleViewProduct = (product: Product) => {
    openViewProductDialog(product);
  };

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

  const onCreateRequested = onCreateProductRequested;
  const onCreateHandled = onCreateProductRequestHandled;

  useEffect(() => {
    if (onCreateRequested) {
      openCreateDialog();
      onCreateHandled?.();
    }
  }, [onCreateRequested, onCreateHandled, openCreateDialog]);

  const { filters, filteredProducts, updateFilters, resetFilters } = useProductFilters(products);
  
  const allSelected = selectedProducts.length === filteredProducts.length && filteredProducts.length > 0;
  
  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  // Компонент карточки для мобильного вида
  const MobileProductCard = ({ product }: { product: Product }) => {
    const isSelected = selectedProducts.includes(product.id);
    const statusType = product.status as StatusType;
    
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 border-b transition-colors group",
        isSelected ? "bg-accent/20" : "hover:bg-accent/5"
      )}>
        <Checkbox 
          checked={isSelected}
          onCheckedChange={() => toggleProductSelection(product.id)}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h4 className="font-medium text-sm truncate">{product.name}</h4>
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
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => handleViewProduct(product)}>
              <Eye className="mr-2 h-4 w-4" /> View
            </DropdownMenuItem>
            {canEditProducts && (
              <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}
            {canUploadFiles && (
              <DropdownMenuItem onClick={() => handleUploadProduct(product)}>
                <Upload className="mr-2 h-4 w-4" /> Files
              </DropdownMenuItem>
            )}
            {canManagePrices && (
              <DropdownMenuItem onClick={() => handlePricesProduct(product)}>
                <DollarSign className="mr-2 h-4 w-4" /> Prices
              </DropdownMenuItem>
            )}
            {canManageNotifications && (
              <DropdownMenuItem onClick={() => handleNotificationsProduct(product)}>
                <Bell className="mr-2 h-4 w-4" /> Notifications
              </DropdownMenuItem>
            )}
            {canManageChangelog && (
              <DropdownMenuItem onClick={() => handleChangelogProduct(product)}>
                <FileText className="mr-2 h-4 w-4" /> Changelog
              </DropdownMenuItem>
            )}
            {canDeleteProducts && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleDeleteProduct(product.id)}
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
  };

  if (!canViewProducts) {
    return <ProductDatabaseAccessDenied />;
  }

  if (error) {
    return <ProductDatabaseErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-4">
      {!loading && filteredProducts.length === 0 && products.length === 0 ? (
        <ProductDatabaseEmptyState 
          onCreateProduct={() => setShowCreateDialog(true)}
          canCreateProducts={canCreateProducts}
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-baseline gap-3">
                <CardTitle className="text-lg font-semibold">Products</CardTitle>
                <CardDescription className="text-xs">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={refetch}
                  disabled={loading}
                  className="h-8 w-8"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <ConditionalRender permission="products.create" fallback={null}>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => setShowCreateDialog(true)}
                    disabled={loading}
                    className="h-8"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </ConditionalRender>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={filters.searchTerm}
                  onChange={(e) => updateFilters({ searchTerm: e.target.value })}
                  className="pl-8 h-8"
                />
              </div>
              <Select 
                value={filters.status} 
                onValueChange={(value: 'all' | 'active' | 'inactive' | 'maintenance' | 'testing') =>
                  updateFilters({ status: value })
                }
              >
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue placeholder="All Status" />
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
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedProducts.length} selected
                  </span>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 px-2">
                    <X className="h-3 w-3 mr-1" />
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
                      <SelectTrigger className="w-32 h-7 text-xs">
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
                      className="h-7"
                    >
                      Apply
                    </Button>
                  </ConditionalRender>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Spinner message="Loading products..." />
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">No products found</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center mb-2 pb-2 border-b">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={filteredProducts.length === 0}
                    className="h-7 text-xs"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Select All
                  </Button>
                </div>
                
                {/* Desktop View: Table */}
                {!isMobile && (
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
                )}

                {/* Mobile View: Cards */}
                {isMobile && (
                  <div className="mt-2">
                    {filteredProducts.map(product => (
                      <MobileProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

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