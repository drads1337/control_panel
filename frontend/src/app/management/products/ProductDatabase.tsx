import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Plus, RefreshCw, Search, Check, X, Package, MoreVertical, Edit, Upload, Bell, DollarSign, FileText, Trash2, Eye } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'maintenance': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'testing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Компонент карточки для мобильного вида
  const MobileProductCard = ({ product }: { product: Product }) => {
    const isSelected = selectedProducts.includes(product.id);
    
    return (
      <div className={cn(
        "flex flex-col p-4 border rounded-lg bg-card text-card-foreground shadow-sm mb-3 transition-colors",
        isSelected ? "border-primary/50 bg-primary/5" : "border-border"
      )}>
        <div className="flex justify-between items-start mb-3 border-b pb-3">
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={isSelected}
              onCheckedChange={() => toggleProductSelection(product.id)}
            />
            <div>
              <h4 className="font-semibold text-sm truncate max-w-[180px]">{product.name}</h4>
              <Badge variant="secondary" className={cn("mt-1 text-xs capitalize", getStatusColor(product.status))}>
                {product.status}
              </Badge>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleViewProduct(product)}>
                <Eye className="mr-2 h-4 w-4" /> View Details
              </DropdownMenuItem>
              {canEditProducts && (
                <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
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
              {canManageStatus && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleStatusChange(product.id, 'active')}>
                    Set Active
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(product.id, 'maintenance')}>
                    Set Maintenance
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(product.id, 'inactive')}>
                    Set Inactive
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(product.id, 'testing')}>
                    Set Testing
                  </DropdownMenuItem>
                </>
              )}
              {canDeleteProducts && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handleDeleteProduct(product.id)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
           <div>
             <span className="font-medium text-foreground">Version:</span> {product.version || 'N/A'}
           </div>
           {product.created_at && (
             <div className="text-right">
               {new Date(product.created_at).toLocaleDateString()}
             </div>
           )}
        </div>
        <div className="mt-2 pt-2 border-t text-xs">
          <span className="font-medium text-foreground">ID:</span> <span className="font-mono opacity-70">{product.id}</span>
        </div>
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
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <div>
                  <CardTitle className="text-base">Products</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                  </CardDescription>
                </div>
                {/* Mobile Refresh/Add buttons moved to top right next to title */}
                <div className="flex sm:hidden items-center gap-2">
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
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </ConditionalRender>
                </div>
              </div>
              
              <div className="hidden sm:flex items-center gap-2">
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

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={filters.searchTerm}
                  onChange={(e) => updateFilters({ searchTerm: e.target.value })}
                  className="pl-8 w-full"
                />
              </div>
              <Select 
                value={filters.status} 
                onValueChange={(value: 'all' | 'active' | 'inactive' | 'maintenance' | 'testing') =>
                  updateFilters({ status: value })
                }
              >
                <SelectTrigger className="w-full sm:w-[180px]">
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-4 border-t gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Selected: {selectedProducts.length}
                  </span>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <ConditionalRender 
                    permissions={['products.status', 'products.delete']}
                    requireAll={false}
                    fallback={null}
                  >
                    <Select value={bulkAction} onValueChange={setBulkAction}>
                      <SelectTrigger className="flex-1 sm:w-40">
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
          <CardContent className={cn("pt-0", !isMobile && "-mt-3")}>
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
                <div className={cn("flex items-center gap-2 mb-2 pb-2 border-b", isMobile && "mt-2")}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={filteredProducts.length === 0}
                    className={cn(isMobile && "w-full")}
                  >
                    <Check className="h-4 w-4 mr-1" />
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