"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { 
  Plus, 
  RefreshCw, 
  Search, 
  Check, 
  MoreVertical, 
  Edit, 
  Upload, 
  Bell, 
  DollarSign, 
  FileText, 
  Trash2, 
  Eye,
  Box,
  LayoutGrid,
  List as ListIcon,
  ArrowUpRight,
  History,
  Shield,
  Filter,
  Monitor,
  Download,
  Users,
  X,
  Package
} from 'lucide-react';

// Hooks
import { useProductQuery, useProductMutations, useProductDialogs } from './hooks';
import { useProductPermissions } from './hooks/use-product-permissions';
import { useProductFilters } from './hooks/use-product-filters';

// UI Components
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { ProductDatabaseEmptyState, ProductDatabaseErrorState, ProductDatabaseAccessDenied } from './components';
import { ProductDatabaseDialogs } from './components/ProductDatabaseDialogs';
import ViewProductDialog from './ViewProductDialog';
import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';
import type { Product } from '@/entities/product';
import { getStatusText } from '@/lib/status-utils';

interface ProductDatabaseProps {
  onCreateProductRequested?: boolean;
  onCreateProductRequestHandled?: () => void;
}

export default function ProductDatabase({ 
  onCreateProductRequested,
  onCreateProductRequestHandled,
}: ProductDatabaseProps) {
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
  const { handleStatusChange, handleDeleteProduct } = useProductMutations();
  
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
    setSelectedProduct,
  } = useProductDialogs();

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  const handleViewProduct = (product: Product) => {
    setSelectedProductForDetail(product);
    setDetailsDialogOpen(true);
  };
  const handleEditProduct = (product: Product) => openEditDialog(product);
  const handleUploadProduct = (product: Product) => openUploadDialog(product);
  const handleNotificationsProduct = (product: Product) => openNotificationsDialog(product);
  const handlePricesProduct = (product: Product) => openPricesDialog(product);
  const handleChangelogProduct = (product: Product) => openChangelogDialog(product);

  useEffect(() => {
    if (onCreateProductRequested) {
      openCreateDialog();
      onCreateProductRequestHandled?.();
    }
  }, [onCreateProductRequested, onCreateProductRequestHandled, openCreateDialog]);

  const { filters, filteredProducts, updateFilters } = useProductFilters(products);

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'testing': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'maintenance': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'inactive': return 'bg-muted/50 text-muted-foreground border-muted-foreground/20';
      default: return 'bg-muted/50 text-muted-foreground border-muted-foreground/20';
    }
  };


  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const formatRevenue = (product: Product): string => {
    return '-';
  };

  const getTimeAgo = (date: string | null | undefined): string => {
    if (!date) return 'Just now';
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  const calculateDistribution = (product: Product): number => {
    if (filteredProducts.length === 0) return 0;
    const maxUsers = Math.max(...filteredProducts.map(p => p.active_users || 0));
    if (maxUsers === 0) return 0;
    return Math.round(((product.active_users || 0) / maxUsers) * 100);
  };

  if (!canViewProducts) return <ProductDatabaseAccessDenied />;
  if (error) return <ProductDatabaseErrorState error={error} onRetry={refetch} />;
  
  if (!loading && filteredProducts.length === 0 && products.length === 0) {
    return <ProductDatabaseEmptyState onCreateProduct={() => setShowCreateDialog(true)} canCreateProducts={canCreateProducts} />;
  }

  return (
    <div className="flex h-[550px] bg-background border rounded-lg shadow-sm overflow-hidden animate-in fade-in duration-300 font-sans">
      
      {/* Main List Area */}
      <div className="flex flex-col w-full">
        
        {/* Header & Controls */}
        <div className="p-3 border-b border-muted-foreground/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">Database</h2>
          </div>
          <ConditionalRender permission="products.create" fallback={null}>
            <Button
              onClick={() => setShowCreateDialog(true)}
              size="sm"
              className="h-8 text-xs gap-1.5"
            >
              <Plus className="size-3" /> New Product
            </Button>
          </ConditionalRender>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 p-3 pt-1.5 pb-1.5 bg-muted/10 border-b border-muted-foreground/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Version</div>
          <div className="col-span-2">Usage</div>
          <div className="col-span-2 text-right">Revenue</div>
        </div>

        {/* List Items */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            filteredProducts.map((product) => {
              return (
                <div 
                  key={product.id}
                  onClick={() => handleViewProduct(product)}
                  className="group grid grid-cols-12 gap-3 p-3 pt-2 pb-2 items-center border-b border-muted-foreground/20 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <div className="col-span-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted/20">
                      <Package className="size-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground leading-tight">{product.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{product.unique_id || `ID: ${product.id}`}</div>
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", getStatusStyle(product.status))}>
                      {product.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>}
                      {getStatusText(product.status as any)}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded border border-muted-foreground/20">v{product.version || '0.0.0'}</span>
                  </div>

                  <div className="col-span-2 flex flex-col justify-center">
                    <div className="flex items-end gap-1 mb-0.5">
                      <span className="text-xs font-medium text-foreground">{product.active_users || 0}</span>
                      <span className="text-[10px] text-muted-foreground mb-px">users</span>
                    </div>
                    <div className="w-16 h-1 bg-muted/20 rounded-full overflow-hidden border border-muted-foreground/10">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${calculateDistribution(product)}%` }}></div>
                    </div>
                  </div>

                  <div className="col-span-2 text-right">
                    <div className="text-xs font-medium text-foreground tabular-nums">{formatRevenue(product)}</div>
                    <div className="text-[10px] text-muted-foreground">{getTimeAgo(product.updated_at)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Footer Stats */}
        <div className="p-3 pt-2 pb-2 border-t border-muted-foreground/20 bg-muted/10 text-xs text-muted-foreground flex justify-between items-center">
          <span>{filteredProducts.length} products</span>
          <span>Total Revenue: <span className="text-foreground font-medium">-</span></span>
        </div>
      </div>

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
        setSelectedProduct={setSelectedProduct}
        closeAllDialogs={closeAllDialogs}
        onSuccess={refetch}
        onUploadComplete={refetch}
      />

      <ViewProductDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        product={selectedProductForDetail}
        onEdit={selectedProductForDetail ? (product) => {
          setDetailsDialogOpen(false);
          handleEditProduct(product);
        } : undefined}
        onUpload={selectedProductForDetail ? (product) => {
          setDetailsDialogOpen(false);
          handleUploadProduct(product);
        } : undefined}
        onPrices={selectedProductForDetail ? (product) => {
          setDetailsDialogOpen(false);
          handlePricesProduct(product);
        } : undefined}
        onNotifications={selectedProductForDetail ? (product) => {
          setDetailsDialogOpen(false);
          handleNotificationsProduct(product);
        } : undefined}
        onChangelog={selectedProductForDetail ? (product) => {
          setDetailsDialogOpen(false);
          handleChangelogProduct(product);
        } : undefined}
        canUploadFiles={canUploadFiles}
        canManagePrices={canManagePrices}
        canManageNotifications={canManageNotifications}
        canManageChangelog={canManageChangelog}
      />
    </div>
  );
}
