"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  RefreshCw, 
  Search, 
  Check, 
  X, 
  Package, 
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
  Filter,
  ArrowUpRight,
  Clock,
  Shield,
  History
} from 'lucide-react';

// Hooks
import { useProductQuery, useProductMutations, useProductSelection, useProductDialogs } from './hooks';
import { useProductPermissions } from './hooks/use-product-permissions';
import { useProductFilters } from './hooks/use-product-filters';
import { useProductDialogStore } from '@/shared/model/use-product-dialog-store';

// UI Components
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { ProductDatabaseEmptyState, ProductDatabaseErrorState, ProductDatabaseAccessDenied } from './components';
import { ProductDatabaseDialogs } from './components/ProductDatabaseDialogs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
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
} from "@/components/ui/table"

import { cn } from '@/lib/utils';
import type { Product } from '@/entities/product';
import { getStatusText } from '@/lib/status-utils';

// Hook for determining screen size
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

export default function ProductDatabase({ 
  onCreateProductRequested,
  onCreateProductRequestHandled,
}: ProductDatabaseProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

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
    setSelectedProduct,
  } = useProductDialogs();

  const { openViewProductDialog } = useProductDialogStore();
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

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

  // Set first product as selected when products load or filter changes
  useEffect(() => {
    if (filteredProducts.length > 0 && selectedProductId === null) {
      setSelectedProductId(filteredProducts[0].id);
    } else if (filteredProducts.length > 0 && selectedProductId !== null) {
      const productExists = filteredProducts.some(p => p.id === selectedProductId);
      if (!productExists) {
        setSelectedProductId(filteredProducts[0].id);
      }
    }
  }, [filteredProducts, selectedProductId]);

  const selectedProductForDetail = filteredProducts.find(p => p.id === selectedProductId) || null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'inactive': return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
      case 'maintenance': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'testing': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  // --- Render Helpers ---

  if (!canViewProducts) return <ProductDatabaseAccessDenied />;
  if (error) return <ProductDatabaseErrorState error={error} onRetry={refetch} />;
  
  if (!loading && filteredProducts.length === 0 && products.length === 0) {
    return (
      <ProductDatabaseEmptyState 
        onCreateProduct={() => setShowCreateDialog(true)}
        canCreateProducts={canCreateProducts}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-[calc(100vh-8rem)] min-h-[600px]">
      <div className={cn("grid gap-4 h-full", isMobile ? "grid-cols-1" : "grid-cols-[260px_1fr]")}>
        
        {/* --- Sidebar (Product List) --- */}
        {!isMobile && (
          <div className="flex flex-col h-full border rounded-lg bg-background shadow-sm overflow-hidden">
            {/* Sidebar Header */}
            <div className="px-3 py-2.5 border-b bg-muted/30">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Database
                </span>
                <div className="flex items-center gap-1">
                   <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-5 w-5"
                      onClick={refetch}
                      disabled={loading}
                    >
                      <RefreshCw className={cn("size-3", loading && "animate-spin")} />
                    </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                 <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                  <Input 
                    placeholder="Find product..." 
                    className="h-7 w-full pl-7 text-xs bg-muted/50 border-muted-foreground/20 focus-visible:bg-background"
                    value={filters.searchTerm}
                    onChange={(e) => updateFilters({ searchTerm: e.target.value })}
                  />
                </div>
                <Select 
                  value={filters.status} 
                  onValueChange={(value: any) => updateFilters({ status: value })}
                >
                  <SelectTrigger className="h-7 text-xs w-full bg-background">
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
            </div>

            {/* Sidebar List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {filteredProducts.length} Items
                </div>
                {loading ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : filteredProducts.map((product) => (
                  <Button
                    key={product.id}
                    variant={selectedProductId === product.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedProductId(product.id)}
                    className={cn(
                      "w-full justify-start h-9 text-xs px-2.5 font-normal rounded-md group relative",
                      selectedProductId === product.id 
                        ? "bg-secondary font-medium shadow-sm" 
                        : "hover:bg-muted/50"
                    )}
                  >
                    <Box className={cn(
                      "size-3.5 mr-2 shrink-0",
                      selectedProductId === product.id ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="truncate flex-1 text-left">{product.name}</span>
                    <span className={cn(
                      "size-1.5 rounded-full ml-2",
                      product.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    )} />
                  </Button>
                ))}
              </div>
            </ScrollArea>

            {/* Sidebar Footer */}
            <div className="px-3 py-2.5 border-t bg-muted/20">
               <ConditionalRender permission="products.create" fallback={null}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full h-8 text-xs border-dashed text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    New Product
                  </Button>
               </ConditionalRender>
            </div>
          </div>
        )}

        {/* --- Main Content (Detail View) --- */}
        <div className="flex flex-col h-full min-w-0 border rounded-lg bg-background shadow-sm overflow-hidden">
          
          {selectedProductForDetail ? (
            <>
              {/* Detail Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b bg-background h-[52px] shrink-0">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {selectedProductForDetail.name}
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 h-4 font-normal capitalize", getStatusColor(selectedProductForDetail.status))}>
                      {getStatusText(selectedProductForDetail.status as any)}
                    </Badge>
                  </div>
                  <div className="flex items-center text-[10px] text-muted-foreground font-mono">
                    <span className="opacity-70">ID:</span>
                    <span className="mx-1 text-foreground">{selectedProductForDetail.unique_id || selectedProductForDetail.id}</span>
                    <span className="mx-2 opacity-30">|</span>
                    <span className="opacity-70">Ver:</span>
                    <span className="mx-1 text-foreground">{selectedProductForDetail.version || '0.0.0'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {canEditProducts && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditProduct(selectedProductForDetail)}>
                      <Edit className="size-3.5 text-muted-foreground" />
                    </Button>
                  )}
                  {canDeleteProducts && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-600" onClick={() => handleDeleteProduct(selectedProductForDetail.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                  <Separator orientation="vertical" className="h-4 mx-1" />
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="size-3.5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-xs">Quick Actions</DropdownMenuLabel>
                      {canManageStatus && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(selectedProductForDetail.id, 'active')} className="text-xs">Set Active</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(selectedProductForDetail.id, 'maintenance')} className="text-xs">Set Maintenance</DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleViewProduct(selectedProductForDetail)} className="text-xs">
                        <Eye className="mr-2 size-3" /> View Full Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Detail Content */}
              <div className="flex-1 overflow-auto bg-muted/5 p-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  {/* Stats Cards */}
                  <Card className="border-muted-foreground/10 shadow-sm bg-background">
                    <CardContent className="p-4 flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Revenue</span>
                      <div className="flex items-center justify-between">
                         <span className="text-lg font-bold">-</span>
                         <DollarSign className="size-4 text-emerald-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-muted-foreground/10 shadow-sm bg-background">
                    <CardContent className="p-4 flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Users</span>
                      <div className="flex items-center justify-between">
                         <span className="text-lg font-bold">{(selectedProductForDetail.active_users || 0).toLocaleString()}</span>
                         <div className="flex h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                            <div className="w-2/3 bg-blue-500" />
                         </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-muted-foreground/10 shadow-sm bg-background">
                    <CardContent className="p-4 flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Downloads</span>
                      <div className="flex items-center justify-between">
                         <span className="text-lg font-bold">{formatNumber(selectedProductForDetail.downloads)}</span>
                         <ArrowUpRight className="size-4 text-muted-foreground opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   {/* Main Info */}
                   <div className="lg:col-span-2 space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                          <FileText className="size-3.5 text-muted-foreground" /> 
                          Description
                        </h3>
                        <Card className="border-muted-foreground/10 bg-background shadow-sm">
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {selectedProductForDetail.description || "No description provided."}
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="space-y-2">
                         <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                              <History className="size-3.5 text-muted-foreground" /> 
                              Recent Activity
                            </h3>
                         </div>
                         <Card className="border-muted-foreground/10 bg-background shadow-sm overflow-hidden">
                           <Table>
                              <TableHeader className="bg-muted/30">
                                <TableRow className="h-8 hover:bg-transparent">
                                  <TableHead className="text-[10px] font-medium h-8">Event</TableHead>
                                  <TableHead className="text-[10px] font-medium h-8 text-right">Date</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow className="h-8 border-b-muted-foreground/5">
                                   <TableCell className="text-xs py-1.5">Product Updated</TableCell>
                                   <TableCell className="text-[10px] text-muted-foreground text-right py-1.5">
                                      {new Date(selectedProductForDetail.updated_at || Date.now()).toLocaleDateString()}
                                   </TableCell>
                                </TableRow>
                                <TableRow className="h-8 border-b-muted-foreground/5">
                                   <TableCell className="text-xs py-1.5">Created</TableCell>
                                   <TableCell className="text-[10px] text-muted-foreground text-right py-1.5">
                                      {new Date(selectedProductForDetail.created_at || Date.now()).toLocaleDateString()}
                                   </TableCell>
                                </TableRow>
                              </TableBody>
                           </Table>
                         </Card>
                      </div>
                   </div>

                   {/* Actions Column */}
                   <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                        <LayoutGrid className="size-3.5 text-muted-foreground" /> 
                        Configuration
                      </h3>
                      <div className="grid grid-cols-1 gap-2">
                         {canUploadFiles && (
                            <Button variant="outline" className="justify-start h-9 text-xs font-normal border-muted-foreground/20 hover:bg-muted/50 bg-background" onClick={() => handleUploadProduct(selectedProductForDetail)}>
                               <Upload className="size-3.5 mr-2 text-blue-500" />
                               Manage Files
                            </Button>
                         )}
                         {canManagePrices && (
                            <Button variant="outline" className="justify-start h-9 text-xs font-normal border-muted-foreground/20 hover:bg-muted/50 bg-background" onClick={() => handlePricesProduct(selectedProductForDetail)}>
                               <DollarSign className="size-3.5 mr-2 text-emerald-500" />
                               Pricing Configuration
                            </Button>
                         )}
                         {canManageNotifications && (
                            <Button variant="outline" className="justify-start h-9 text-xs font-normal border-muted-foreground/20 hover:bg-muted/50 bg-background" onClick={() => handleNotificationsProduct(selectedProductForDetail)}>
                               <Bell className="size-3.5 mr-2 text-amber-500" />
                               Notifications
                            </Button>
                         )}
                         {canManageChangelog && (
                            <Button variant="outline" className="justify-start h-9 text-xs font-normal border-muted-foreground/20 hover:bg-muted/50 bg-background" onClick={() => handleChangelogProduct(selectedProductForDetail)}>
                               <ListIcon className="size-3.5 mr-2 text-purple-500" />
                               Version History
                            </Button>
                         )}
                      </div>

                      <div className="pt-4 mt-4 border-t border-muted-foreground/10">
                        <div className="p-3 bg-muted/20 rounded-lg border border-muted-foreground/5">
                           <div className="flex items-center gap-2 mb-2">
                              <Shield className="size-3.5 text-muted-foreground" />
                              <span className="text-[10px] font-semibold uppercase text-muted-foreground">System Status</span>
                           </div>
                           <div className="flex items-center justify-between text-xs">
                              <span>Health Check</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                 <Check className="size-3" /> Passing
                              </span>
                           </div>
                        </div>
                      </div>
                   </div>
                </div>
              </div>

              {/* Detail Footer */}
              <div className="h-8 border-t bg-background flex items-center justify-between px-4 text-[10px] text-muted-foreground shrink-0">
                <div className="flex items-center gap-4">
                  <span>Last synced: just now</span>
                  <Separator orientation="vertical" className="h-3" />
                  <span>{selectedProductForDetail.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex size-1.5 rounded-full bg-emerald-500" />
                  <span>Online</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
               <Package className="size-10 text-muted-foreground/20 mb-3" />
               <p className="text-xs">Select a product from the database to view details</p>
            </div>
          )}
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
    </div>
  );
}