"use client"

import * as React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createProduct } from '@/entities/product';
import { createFolder } from '@/entities/file';
import { toast } from 'sonner';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { getErrorMessage } from '@/shared/lib/utils/error-utils';

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CreateProductDialog({ open, onOpenChange, onSuccess }: CreateProductDialogProps) {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('products.create');

  if (!canCreate) {
    return null;
  }

  const [creatingProduct, setCreatingProduct] = useState(false);
  const [createProductData, setCreateProductData] = useState<{
    name: string;
    description: string;
    is_multi_app: boolean;
    version: string;
  }>({
    name: '',
    description: '',
    is_multi_app: false,
    version: '1.0.0'
  });

  const handleCreateProduct = async () => {
    if (!createProductData.name.trim()) {
      toast.error('Product name is required.');
      return;
    }

    try {
      setCreatingProduct(true);

      const productData = {
        name: createProductData.name.trim(),
        description: createProductData.description.trim() || undefined,
        is_multi_app: createProductData.is_multi_app,
        version: createProductData.version.trim() || '1.0.0'
      }

      let response: Awaited<ReturnType<typeof createProduct>>;
      try {
        response = await createProduct(productData);
      } catch {
        response = await createProduct(productData);
      }

      const createdProduct = response.product;

      if (response.success && createdProduct) {
        try {
          await createFolder({
            name: 'configs',
            parent_path: '/',
            product_id: createdProduct.id
          });

        } catch (folderError) {
          // Ignore folder creation error
        }
      }

      if (response.success && createdProduct) {
        toast.success('Product successfully created!');
        onOpenChange(false);
        setCreateProductData({
          name: '',
          description: '',
          is_multi_app: false,
          version: '1.0.0'
        });
        onSuccess?.();
      } else {
        toast.error(response.message || 'Failed to create product.');
      }
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err)
      toast.error(errorMessage)
    } finally {
      setCreatingProduct(false);
    }
  };
  
  const handleCancel = () => {
    onOpenChange(false);
    setCreateProductData({
      name: '',
      description: '',
      is_multi_app: false,
      version: '1.0.0'
    });
  };

  if (!canCreate) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle className="text-base">Create New Product</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Fill in the details for the new product.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1 scrollbar-thin">
          <div className="space-y-2">
            <Label htmlFor="productName" className="text-xs">Product Name *</Label>
            <Input 
              id="productName" 
              placeholder="Enter product name"
              value={createProductData.name}
              onChange={(e) => setCreateProductData(prev => ({ ...prev, name: e.target.value }))}
              className="h-7 text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productDescription" className="text-xs">Description</Label>
            <Input 
              id="productDescription" 
              placeholder="Enter product description (optional)"
              value={createProductData.description}
              onChange={(e) => setCreateProductData(prev => ({ ...prev, description: e.target.value }))}
              className="h-7 text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productType" className="text-xs">Product Type</Label>
            <Select 
              value={createProductData.is_multi_app ? 'multi_app' : 'product_library'}
              onValueChange={(value) => setCreateProductData(prev => ({ 
                ...prev, 
                is_multi_app: value === 'multi_app' 
              }))}
            >
              <SelectTrigger className="w-full h-7 text-xs">
                <SelectValue placeholder="Select product type" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="product_library" className="text-xs">Product Library</SelectItem>
                <SelectItem value="multi_app" className="text-xs">Multi-App</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="productVersion" className="text-xs">Version</Label>
            <Input 
              id="productVersion" 
              placeholder="1.0.0" 
              value={createProductData.version}
              onChange={(e) => setCreateProductData(prev => ({ ...prev, version: e.target.value }))}
              className="h-7 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0 mt-2">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={creatingProduct}
            size="sm"
            className="h-7 text-xs w-full sm:w-auto mt-2 sm:mt-0"
          >
            Cancel
          </Button>
          <ConditionalRender permission="products.create" fallback={null}>
            <Button 
              onClick={handleCreateProduct}
              disabled={creatingProduct || !createProductData.name.trim()}
              size="sm"
              className="h-7 text-xs w-full sm:w-auto"
            >
              {creatingProduct ? 'Creating...' : 'Create Product'}
            </Button>
          </ConditionalRender>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

