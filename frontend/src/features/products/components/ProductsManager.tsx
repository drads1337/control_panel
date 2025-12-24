import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Search, Code2, Edit, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/components/button';
import { Input } from '@/shared/ui/components/input';
import { Label } from '@/shared/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/components/select';
import { Checkbox } from '@/shared/ui/components/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui/components/dialog';
import { useProductsQuery } from '@/features/product-database/hooks/use-products-query';
import { 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  updateProductStatus,
  type CreateProductData,
  type UpdateProductData
} from '@/entities/product';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productKeys } from '@/features/product-database/hooks/use-products-query';
import { toast } from 'sonner';
import type { Product } from '@/entities/product';

export const ProductsManager: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
    
    // Form state
    const [formData, setFormData] = useState<CreateProductData>({
        name: '',
        description: '',
        status: 'active',
        version: '1.0.0',
        is_multi_app: false,
    });

    const queryClient = useQueryClient();
    const { products, loading, refetch } = useProductsQuery('all');

    // Create mutation
    const createMutation = useMutation({
        mutationFn: createProduct,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
            toast.success('Product created successfully');
            setCreateDialogOpen(false);
            resetForm();
            refetch();
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Failed to create product');
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateProductData }) => updateProduct(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
            toast.success('Product updated successfully');
            setEditDialogOpen(false);
            setEditingProduct(null);
            resetForm();
            refetch();
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Failed to update product');
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteProduct(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
            toast.success('Product deleted successfully');
            setDeleteDialogOpen(false);
            setDeletingProduct(null);
            refetch();
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Failed to delete product');
        },
    });

    // Status update mutation
    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number; status: 'active' | 'inactive' | 'maintenance' | 'testing' }) => 
            updateProductStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
            toast.success('Product status updated successfully');
            refetch();
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Failed to update product status');
        },
    });

    const resetForm = useCallback(() => {
        setFormData({
            name: '',
            description: '',
            status: 'active',
            version: '1.0.0',
            is_multi_app: false,
        });
    }, []);

    const openCreateDialog = useCallback(() => {
        resetForm();
        setCreateDialogOpen(true);
    }, [resetForm]);

    const openEditDialog = useCallback((product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description || '',
            status: (product.status as any) || 'active',
            version: product.version || '1.0.0',
            is_multi_app: product.is_multi_app || false,
        });
        setEditDialogOpen(true);
    }, []);

    const openDeleteDialog = useCallback((product: Product) => {
        setDeletingProduct(product);
        setDeleteDialogOpen(true);
    }, []);

    const handleCreate = useCallback(() => {
        if (!formData.name.trim()) {
            toast.error('Product name is required');
            return;
        }
        createMutation.mutate(formData);
    }, [formData, createMutation]);

    const handleUpdate = useCallback(() => {
        if (!editingProduct || !formData.name.trim()) {
            toast.error('Product name is required');
            return;
        }
        const updateData: UpdateProductData = {
            name: formData.name,
            description: formData.description,
            version: formData.version,
            is_multi_app: formData.is_multi_app,
        };
        updateMutation.mutate({
            id: typeof editingProduct.id === 'string' ? parseInt(editingProduct.id) : editingProduct.id,
            data: updateData,
        });
    }, [editingProduct, formData, updateMutation]);

    const handleDelete = useCallback(() => {
        if (!deletingProduct) return;
        const productId = typeof deletingProduct.id === 'string' ? parseInt(deletingProduct.id) : deletingProduct.id;
        deleteMutation.mutate(productId);
    }, [deletingProduct, deleteMutation]);

    const handleStatusChange = useCallback((product: Product, newStatus: string) => {
        const productId = typeof product.id === 'string' ? parseInt(product.id) : product.id;
        statusMutation.mutate({
            id: productId,
            status: newStatus as 'active' | 'inactive' | 'maintenance' | 'testing',
        });
    }, [statusMutation]);

    const toggleProductSelection = useCallback((productId: number) => {
        setSelectedProducts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });
    }, []);

    // Filtered products
    const filteredProducts = useMemo(() => {
        let filtered = products || [];

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(query) ||
                p.description?.toLowerCase().includes(query) ||
                p.unique_id.toLowerCase().includes(query)
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(p => {
                const status = p.status.toLowerCase();
                return status === statusFilter.toLowerCase();
            });
        }

        return filtered;
    }, [products, searchQuery, statusFilter]);

    const statusDisplayMap: Record<string, string> = {
        'active': 'ACTIVE',
        'inactive': 'INACTIVE',
        'maintenance': 'MAINTENANCE',
        'testing': 'TESTING',
    };

    const getStatusColor = (status: string) => {
        const statusLower = status.toLowerCase();
        if (statusLower === 'active') {
            return 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20';
        } else if (statusLower === 'maintenance') {
            return 'bg-orange-500/5 text-orange-400 border-orange-500/20';
        } else if (statusLower === 'inactive') {
            return 'bg-gray-500/5 text-gray-400 border-gray-500/20';
        }
        return 'bg-blue-500/5 text-blue-400 border-blue-500/20';
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-text-primary-dark tracking-wide font-display">Products</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <p className="text-[10px] text-text-secondary-dark font-mono uppercase tracking-wider">
                            {loading ? 'Loading...' : `${filteredProducts.length} configured`}
                        </p>
                    </div>
                </div>
                <Button 
                    onClick={openCreateDialog}
                    className="bg-primary hover:bg-primary-hover text-background-dark px-3 py-1.5 rounded-sm text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-glow h-auto"
                >
                    <Plus className="text-sm" />
                    NEW PRODUCT
                </Button>
            </div>

            {/* Filter Toolbar */}
            <div className="grid grid-cols-12 gap-2.5 mb-3 bg-surface-dark/30 p-1.5 rounded border border-border-dark/50">
                <div className="col-span-9 relative group">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none z-10">
                        <Search className="text-text-secondary-dark w-2.5 h-2.5 group-focus-within:text-primary transition-colors" />
                    </span>
                    <Input 
                        className="w-full bg-background-dark border border-border-dark rounded-sm pl-8 pr-3 py-1.5 text-[11px] text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-[10px] placeholder:text-text-secondary-dark/50 transition-all outline-none font-mono h-[28px]" 
                        placeholder="SEARCH_DB..." 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="col-span-3">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[28px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent 
                            className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                            position="popper"
                        >
                            <SelectItem value="all" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">All Status</SelectItem>
                            <SelectItem value="active" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Active</SelectItem>
                            <SelectItem value="maintenance" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Maintenance</SelectItem>
                            <SelectItem value="inactive" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Inactive</SelectItem>
                            <SelectItem value="testing" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Testing</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Product List */}
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {loading ? (
                    <div className="flex items-center justify-center h-32 text-text-secondary-dark">
                        <p className="text-sm">Loading products...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-text-secondary-dark">
                        <p className="text-sm">No products found</p>
                    </div>
                ) : (
                    filteredProducts.map((product) => {
                        const productId = typeof product.id === 'string' ? parseInt(product.id) : product.id;
                        const isSelected = selectedProducts.has(productId);
                        
                        return (
                            <div 
                                key={product.id} 
                                className="bg-surface-dark border border-border-dark rounded-sm p-3 flex items-center justify-between group hover:border-text-secondary-dark/30 transition-all"
                            >
                                {/* Left Section: Info */}
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    {/* Selection */}
                                    <div className="flex items-center justify-center">
                                        <div 
                                            className={`w-3.5 h-3.5 rounded-full border cursor-pointer transition-colors ${
                                                isSelected 
                                                    ? 'bg-primary border-primary' 
                                                    : 'border-border-dark hover:border-primary'
                                            }`}
                                            onClick={() => toggleProductSelection(productId)}
                                        />
                                    </div>
                                    
                                    {/* Icon Box */}
                                    <div className="w-9 h-9 rounded bg-background-dark border border-border-dark flex items-center justify-center text-text-secondary-dark group-hover:text-primary transition-colors shadow-sm">
                                        <Code2 className="text-lg" />
                                    </div>

                                    {/* Main Details */}
                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-text-primary-dark truncate font-display">{product.name}</span>
                                            <span className={`text-[9px] font-bold px-1 py-px rounded-[2px] border tracking-wider uppercase ${getStatusColor(product.status)}`}>
                                                {statusDisplayMap[product.status.toLowerCase()] || product.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-text-secondary-dark font-mono leading-none mt-0.5">
                                            <span className="opacity-60">VER <span className="text-text-primary-dark opacity-100">{product.version}</span></span>
                                            <span className="w-px h-2 bg-border-dark"></span>
                                            <span className="opacity-60">ID: <span className="text-text-primary-dark opacity-100">{product.unique_id}</span></span>
                                            <span className="w-px h-2 bg-border-dark"></span>
                                            <span className="px-1.5 py-px rounded bg-white/5 border border-border-dark text-[9px] opacity-70">LICENSE</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Section: Stats & Actions */}
                                <div className="flex items-center gap-6">
                                    {/* Stats */}
                                    <div className="hidden xl:flex items-center gap-4 text-[10px] font-mono text-text-secondary-dark border-r border-border-dark pr-6 mr-2">
                                        <div className="flex flex-col items-end leading-tight">
                                            <span className="text-text-primary-dark font-bold">{product.downloads || 0}</span>
                                            <span className="text-[9px] opacity-50 uppercase">Downloads</span>
                                        </div>
                                        <div className="flex flex-col items-end leading-tight">
                                            <span className="text-text-primary-dark font-bold">{product.active_users || 0}</span>
                                            <span className="text-[9px] opacity-50 uppercase">Users</span>
                                        </div>
                                    </div>

                                    {/* Controls */}
                                    <div className="flex items-center gap-2">
                                        <Select 
                                            value={product.status.toLowerCase()}
                                            onValueChange={(value) => handleStatusChange(product, value)}
                                        >
                                            <SelectTrigger className="w-32 min-w-[128px] bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent 
                                                className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm min-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)] !z-[100]"
                                                position="popper"
                                            >
                                                <SelectItem value="active" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Active</SelectItem>
                                                <SelectItem value="maintenance" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Maintenance</SelectItem>
                                                <SelectItem value="inactive" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Disabled</SelectItem>
                                                <SelectItem value="testing" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Testing</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditDialog(product)}
                                            className="w-6 h-6 rounded-sm hover:bg-white/5 text-text-secondary-dark hover:text-text-primary-dark border border-transparent hover:border-border-dark"
                                        >
                                            <Edit className="text-xs" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openDeleteDialog(product)}
                                            className="w-6 h-6 rounded-sm hover:bg-white/5 text-text-secondary-dark hover:text-text-primary-dark border border-transparent hover:border-border-dark"
                                        >
                                            <MoreHorizontal className="text-sm" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer Pagination */}
            <div className="flex items-center justify-between pt-3 border-t border-border-dark mt-auto">
                <span className="text-[9px] font-mono text-text-secondary-dark uppercase tracking-widest opacity-50">
                    {filteredProducts.length > 0 
                        ? `Row 1-${filteredProducts.length} of ${products.length}`
                        : 'No products'
                    }
                </span>
                <div className="flex gap-1">
                    <Button 
                        variant="outline"
                        size="icon"
                        className="w-6 h-6 rounded-sm border border-border-dark bg-background-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 disabled:opacity-30"
                    >
                        <ChevronLeft className="text-xs" />
                    </Button>
                    <Button 
                        variant="outline"
                        size="icon"
                        className="w-6 h-6 rounded-sm border border-border-dark bg-background-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 disabled:opacity-30"
                    >
                        <ChevronRight className="text-xs" />
                    </Button>
                </div>
            </div>

            {/* Create Product Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-text-primary-dark">Create New Product</DialogTitle>
                        <DialogDescription className="text-text-secondary-dark">
                            Fill in the details to create a new product
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-text-secondary-dark">Product Name *</Label>
                            <Input
                                id="name"
                                className="bg-background-dark border-border-dark text-text-primary-dark"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter product name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-text-secondary-dark">Description</Label>
                            <Input
                                id="description"
                                className="bg-background-dark border-border-dark text-text-primary-dark"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Enter product description"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="version" className="text-text-secondary-dark">Version</Label>
                                <Input
                                    id="version"
                                    className="bg-background-dark border-border-dark text-text-primary-dark"
                                    value={formData.version}
                                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                    placeholder="1.0.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status" className="text-text-secondary-dark">Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent 
                                        className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                                        position="popper"
                                    >
                                        <SelectItem value="active" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Active</SelectItem>
                                        <SelectItem value="inactive" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Inactive</SelectItem>
                                        <SelectItem value="maintenance" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Maintenance</SelectItem>
                                        <SelectItem value="testing" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Testing</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_multi_app"
                                checked={formData.is_multi_app}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_multi_app: checked === true })}
                                className="rounded border-border-dark"
                            />
                            <Label htmlFor="is_multi_app" className="text-text-secondary-dark">Multi-App Product</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCreateDialogOpen(false)}
                            className="bg-background-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={createMutation.isPending || !formData.name.trim()}
                            className="bg-primary hover:bg-primary-hover text-background-dark"
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create Product'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Product Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-text-primary-dark">Edit Product</DialogTitle>
                        <DialogDescription className="text-text-secondary-dark">
                            Update product details
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-text-secondary-dark">Product Name *</Label>
                            <Input
                                id="edit-name"
                                className="bg-background-dark border-border-dark text-text-primary-dark"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter product name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-description" className="text-text-secondary-dark">Description</Label>
                            <Input
                                id="edit-description"
                                className="bg-background-dark border-border-dark text-text-primary-dark"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Enter product description"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-version" className="text-text-secondary-dark">Version</Label>
                                <Input
                                    id="edit-version"
                                    className="bg-background-dark border-border-dark text-text-primary-dark"
                                    value={formData.version}
                                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                    placeholder="1.0.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-status" className="text-text-secondary-dark">Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger className="w-full bg-background-dark border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary h-[30px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent 
                                        className="!bg-surface-dark border-border-dark text-text-primary-dark shadow-lg backdrop-blur-sm !min-w-0 w-[var(--radix-select-trigger-width)] !z-[100]"
                                        position="popper"
                                    >
                                        <SelectItem value="active" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Active</SelectItem>
                                        <SelectItem value="inactive" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Inactive</SelectItem>
                                        <SelectItem value="maintenance" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Maintenance</SelectItem>
                                        <SelectItem value="testing" className="text-text-primary-dark hover:!bg-white/10 focus:!bg-primary/20 focus:text-text-primary-dark cursor-pointer">Testing</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="edit-is_multi_app"
                                checked={formData.is_multi_app}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_multi_app: checked === true })}
                                className="rounded border-border-dark"
                            />
                            <Label htmlFor="edit-is_multi_app" className="text-text-secondary-dark">Multi-App Product</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditDialogOpen(false)}
                            className="bg-background-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            disabled={updateMutation.isPending || !formData.name.trim()}
                            className="bg-primary hover:bg-primary-hover text-background-dark"
                        >
                            {updateMutation.isPending ? 'Updating...' : 'Update Product'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Product Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-text-primary-dark">Delete Product</DialogTitle>
                        <DialogDescription className="text-text-secondary-dark">
                            Are you sure you want to delete <strong>{deletingProduct?.name}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            className="bg-background-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
