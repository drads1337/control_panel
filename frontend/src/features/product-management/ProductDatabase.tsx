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
  Key,
  Settings,
  Cloud,
  Lock,
  CreditCard,
  Database,
  Activity
} from 'lucide-react';

// Hooks
import { useProductQuery, useProductMutations, useProductDialogs } from './hooks';
import { useProductPermissions } from './hooks/use-product-permissions';
import { useProductFilters } from './hooks/use-product-filters';
import { useProductDialogStore } from '@/shared/model/use-product-dialog-store';

// UI Components
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { ProductDatabaseEmptyState, ProductDatabaseErrorState, ProductDatabaseAccessDenied } from './components';
import { ProductDatabaseDialogs } from './components/ProductDatabaseDialogs';
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

  const { openViewProductDialog } = useProductDialogStore();
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  const handleViewProduct = (product: Product) => openViewProductDialog(product);
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

  // Auto-select first product
  useEffect(() => {
    if (filteredProducts.length > 0 && selectedProductForDetail === null) {
      setSelectedProductForDetail(filteredProducts[0]);
    } else if (filteredProducts.length > 0 && selectedProductForDetail !== null) {
      if (!filteredProducts.some(p => p.id === selectedProductForDetail.id)) {
        setSelectedProductForDetail(filteredProducts[0]);
      }
    }
  }, [filteredProducts, selectedProductForDetail]);

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'testing': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'maintenance': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'inactive': return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getIconForProduct = (product: Product) => {
    const icons = [Package, Database, Key, Settings, Cloud, Lock, CreditCard, Activity];
    return icons[product.id % icons.length];
  };

  const getIconColor = (product: Product) => {
    const colors = [
      'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
      'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
      'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
      'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
      'text-rose-500 bg-rose-50 dark:bg-rose-900/20',
    ];
    return colors[product.id % colors.length];
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

  const getStatusFilter = () => {
    if (filters.status === 'all') return 'All';
    if (filters.status === 'active') return 'Active';
    if (filters.status === 'testing') return 'Beta';
    if (filters.status === 'maintenance') return 'Dev';
    return 'All';
  };

  const setStatusFilter = (filter: string) => {
    if (filter === 'All') updateFilters({ status: 'all' });
    else if (filter === 'Active') updateFilters({ status: 'active' });
    else if (filter === 'Beta') updateFilters({ status: 'testing' });
    else if (filter === 'Dev') updateFilters({ status: 'maintenance' });
  };

  if (!canViewProducts) return <ProductDatabaseAccessDenied />;
  if (error) return <ProductDatabaseErrorState error={error} onRetry={refetch} />;
  
  if (!loading && filteredProducts.length === 0 && products.length === 0) {
    return <ProductDatabaseEmptyState onCreateProduct={() => setShowCreateDialog(true)} canCreateProducts={canCreateProducts} />;
  }

  const statusFilter = getStatusFilter();

  return (
    <div className="flex h-[750px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden animate-in fade-in duration-300 font-sans">
      
      {/* Main List Area */}
      <div className={cn("flex flex-col transition-all duration-300 ease-in-out", selectedProductForDetail ? 'w-[60%]' : 'w-full')}>
        
        {/* Header & Controls */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Products</h2>
            <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
              {['All', 'Active', 'Beta', 'Dev'].map(f => (
                <button 
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    statusFilter === f 
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <ConditionalRender permission="products.create" fallback={null}>
            <button 
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black rounded-md text-xs font-bold transition-colors"
            >
              <Plus className="size-3.5" /> New Product
            </button>
          </ConditionalRender>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-2 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-gray-400">
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
              const IconComponent = getIconForProduct(product);
              return (
                <div 
                  key={product.id}
                  onClick={() => setSelectedProductForDetail(product)}
                  className={cn(
                    "group grid grid-cols-12 gap-4 px-6 py-3 items-center border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors",
                    selectedProductForDetail?.id === product.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  )}
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-md flex items-center justify-center", getIconColor(product))}>
                      <IconComponent className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{product.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">{product.unique_id || `ID: ${product.id}`}</div>
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border", getStatusStyle(product.status))}>
                      {product.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>}
                      {getStatusText(product.status as any)}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">v{product.version || '0.0.0'}</span>
                  </div>

                  <div className="col-span-2 flex flex-col justify-center">
                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{product.active_users || 0}</span>
                      <span className="text-[10px] text-gray-400 mb-px">users</span>
                    </div>
                    <div className="w-16 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${calculateDistribution(product)}%` }}></div>
                    </div>
                  </div>

                  <div className="col-span-2 text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">{formatRevenue(product)}</div>
                    <div className="text-[10px] text-gray-400">{getTimeAgo(product.updated_at)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Footer Stats */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20 text-xs text-gray-500 flex justify-between items-center">
          <span>{filteredProducts.length} products</span>
          <span>Total Revenue: <span className="text-gray-900 dark:text-white font-medium">-</span></span>
        </div>
      </div>

      {/* Side Panel Details */}
      {selectedProductForDetail && (
        <div className="w-[40%] border-l border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center shadow-sm", getIconColor(selectedProductForDetail))}>
                {(() => {
                  const IconComponent = getIconForProduct(selectedProductForDetail);
                  return <IconComponent className="size-7" />;
                })()}
              </div>
              <button 
                onClick={() => setSelectedProductForDetail(null)} 
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{selectedProductForDetail.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{selectedProductForDetail.description || 'No description provided.'}</p>
            
            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => handleViewProduct(selectedProductForDetail)}
                className="flex-1 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors shadow-sm"
              >
                View Documentation
              </button>
              <ConditionalRender permission="keys.view" fallback={null}>
                <button 
                  onClick={() => handleViewProduct(selectedProductForDetail)}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-colors shadow-sm"
                >
                  Manage Keys
                </button>
              </ConditionalRender>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Stats Cards in Panel */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Downloads</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(selectedProductForDetail.downloads)}</div>
              </div>
              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Active Users</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedProductForDetail.active_users || 0}</div>
              </div>
            </div>

            {/* Details List */}
            <div>
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 px-1">Configuration</h3>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                {canUploadFiles && (
                  <div 
                    onClick={() => handleUploadProduct(selectedProductForDetail)}
                    className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Upload className="size-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Files</span>
                    </div>
                    <span className="text-xs text-gray-500">Manage</span>
                  </div>
                )}
                {canManagePrices && (
                  <div 
                    onClick={() => handlePricesProduct(selectedProductForDetail)}
                    className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="size-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Pricing</span>
                    </div>
                    <span className="text-xs text-gray-500">Configure</span>
                  </div>
                )}
                {canManageNotifications && (
                  <div 
                    onClick={() => handleNotificationsProduct(selectedProductForDetail)}
                    className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="size-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Notifications</span>
                    </div>
                    <span className="text-xs text-gray-500">Manage</span>
                  </div>
                )}
                {canManageChangelog && (
                  <div 
                    onClick={() => handleChangelogProduct(selectedProductForDetail)}
                    className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <ListIcon className="size-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Changelog</span>
                    </div>
                    <span className="text-xs text-gray-500">View</span>
                  </div>
                )}
                <div className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <Shield className="size-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Security Level</span>
                  </div>
                  <span className="text-xs text-gray-500">High</span>
                </div>
                <div className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <Cloud className="size-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Cloud Sync</span>
                  </div>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Enabled</span>
                </div>
                <div className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <Settings className="size-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">API Limits</span>
                  </div>
                  <span className="text-xs text-gray-500">Unlimited</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 px-1">Recent Activity</h3>
              <div className="space-y-3 pl-2 border-l border-gray-200 dark:border-gray-800 ml-2">
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black bg-blue-500"></div>
                  <div className="text-xs text-gray-900 dark:text-white font-medium">Version {selectedProductForDetail.version || '0.0.0'} released</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{getTimeAgo(selectedProductForDetail.updated_at)}</div>
                </div>
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black bg-gray-300 dark:bg-gray-600"></div>
                  <div className="text-xs text-gray-900 dark:text-white font-medium">Product updated</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{getTimeAgo(selectedProductForDetail.updated_at)}</div>
                </div>
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black bg-gray-300 dark:bg-gray-600"></div>
                  <div className="text-xs text-gray-900 dark:text-white font-medium">Product created</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{getTimeAgo(selectedProductForDetail.created_at)}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
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
        setSelectedProduct={setSelectedProduct}
        closeAllDialogs={closeAllDialogs}
        onSuccess={refetch}
        onUploadComplete={refetch}
      />
    </div>
  );
}
