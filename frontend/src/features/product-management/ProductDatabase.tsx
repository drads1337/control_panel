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
  Package,
  AlertTriangle,
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
import { ProductDatabaseErrorState } from './components';
import { EmptyState } from '@/shared/ui/components';
import { AccessDenied } from '@/shared/ui/components';
import { ProductDatabaseDialogs } from './components/ProductDatabaseDialogs';
import ViewProductDialog from './components/ViewProductDialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { cn } from '@/lib/utils.ts';
import type { Product } from '@/entities/product';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';

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
  
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };
  
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

  if (!canViewProducts) {
    return (
      <AccessDenied
        isAuthenticated={true}
        hasAccess={false}
        noPermissionMessage="You don't have permission to view products."
        useCard={true}
        icon={AlertTriangle}
        containerClassName="p-4 sm:p-6"
      />
    );
  }
  if (error) return <ProductDatabaseErrorState error={error} onRetry={refetch} />;
  
  if (!loading && filteredProducts.length === 0 && products.length === 0) {
    return (
      <>
        <EmptyState
          title="No Products Yet"
          description="Get started by creating your first product. You can manage settings, upload files, and track usage."
          actionLabel="Create Your First Product"
          onAction={() => setShowCreateDialog(true)}
          canAction={canCreateProducts}
          icon={Package}
          iconStyle="gradient"
          useCard={true}
          buttonSize="lg"
          showButtonIcon={true}
          titleTag="h3"
        />
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
      </>
    );
  }

  return (
    <div className="flex flex-col h-[550px] bg-background border rounded-lg shadow-sm overflow-hidden animate-in fade-in duration-300 font-sans">
      
      {/* Header & Controls */}
      <div className="p-3 border-b border-muted-foreground/20 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Database</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="h-8 w-8"
          >
            {refreshing ? (
              <Spinner className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
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
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex justify-center items-center flex-1">
            <Spinner />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="rounded-lg border bg-background">
              <Table>
                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                  <TableRow className="h-9 hover:bg-transparent border-b-muted-foreground/10">
                    <TableHead className="text-xs h-9 font-medium text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs h-9 font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs h-9 font-medium text-muted-foreground">Version</TableHead>
                    <TableHead className="text-xs h-9 font-medium text-muted-foreground">Usage</TableHead>
                    <TableHead className="text-xs h-9 font-medium text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <TableRow
                        key={product.id}
                        className="h-12 text-xs border-b-muted-foreground/5 hover:bg-background hover:shadow-sm transition-all cursor-pointer"
                        onClick={() => handleViewProduct(product)}
                      >
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted/20">
                              <Package className="size-3.5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-foreground leading-tight">{product.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{product.unique_id || `ID: ${product.id}`}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className={cn(getStatusClasses(product.status as StatusType), "rounded-none")}>
                            {getStatusText(product.status as StatusType)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className={cn(getStatusClasses('inactive' as StatusType), "rounded-none text-xs font-medium")}>
                            v{product.version || '0.0.0'}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-col justify-center">
                            <div className="flex items-end gap-1 mb-0.5">
                              <span className="text-xs font-medium text-foreground">{product.active_users || 0}</span>
                              <span className="text-[10px] text-muted-foreground mb-px">users</span>
                            </div>
                            <Progress 
                              value={calculateDistribution(product)} 
                              className="w-16 h-1 rounded-none [&>div]:bg-blue-500 [&>div]:rounded-none"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <MoreVertical className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => handleViewProduct(product)}>
                                  <Eye className="size-3.5 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {canEditProducts && (
                                  <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                                    <Edit className="size-3.5 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {canUploadFiles && (
                                  <DropdownMenuItem onClick={() => handleUploadProduct(product)}>
                                    <Upload className="size-3.5 mr-2" />
                                    Files
                                  </DropdownMenuItem>
                                )}
                                {canManagePrices && (
                                  <DropdownMenuItem onClick={() => handlePricesProduct(product)}>
                                    <DollarSign className="size-3.5 mr-2" />
                                    Pricing
                                  </DropdownMenuItem>
                                )}
                                {canManageNotifications && (
                                  <DropdownMenuItem onClick={() => handleNotificationsProduct(product)}>
                                    <Bell className="size-3.5 mr-2" />
                                    Notifications
                                  </DropdownMenuItem>
                                )}
                                {canManageChangelog && (
                                  <DropdownMenuItem onClick={() => handleChangelogProduct(product)}>
                                    <ListIcon className="size-3.5 mr-2" />
                                    Changelog
                                  </DropdownMenuItem>
                                )}
                                {canManageStatus && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
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
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                        No products found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        
        {/* Footer Stats */}
        <div className="p-3 pt-2 pb-2 border-t border-muted-foreground/20 bg-muted/10 text-xs text-muted-foreground flex-shrink-0">
          <span>{filteredProducts.length} products</span>
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
      />
    </div>
  );
}
