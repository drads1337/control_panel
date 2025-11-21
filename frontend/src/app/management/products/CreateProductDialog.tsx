import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, Plus, FileText, Globe, GitCommit
} from 'lucide-react';
import { createProduct } from '@/entities/product';
import { createFolder } from '@/entities/file';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { getErrorMessage } from '@/shared/api/enhanced-client';

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateProductDialog: React.FC<CreateProductDialogProps> = ({ open, onOpenChange, onSuccess }) => {
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

      // Use new universal function, fallback to old one
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
            product_id: createdProduct.id  // Keep product_id for backward compatibility
          });

        } catch (folderError) {

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
        onSuccess();
      } else {
        toast.error(response.message || 'Failed to create product.');

      }
    } catch (err: unknown) {

      if (import.meta.env.DEV) {

        if (err && typeof err === 'object' && 'debug' in err) {
          const debugInfo = (err as any).debug

        }
      }

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Product</DialogTitle>
          <DialogDescription>
            Fill in the details for the new product.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productName">Product Name *</Label>
            <Input 
              id="productName" 
              placeholder="Enter product name"
              value={createProductData.name}
              onChange={(e) => setCreateProductData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productDescription">Description</Label>
            <Input 
              id="productDescription" 
              placeholder="Enter product description (optional)"
              value={createProductData.description}
              onChange={(e) => setCreateProductData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productType">Product Type</Label>
            <Select 
              value={createProductData.is_multi_app ? 'multi_app' : 'product_library'}
              onValueChange={(value) => setCreateProductData(prev => ({ 
                ...prev, 
                is_multi_app: value === 'multi_app' 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product_library">Product Library</SelectItem>
                <SelectItem value="multi_app">Multi-App</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="productVersion">Version</Label>
            <Input 
              id="productVersion" 
              placeholder="1.0.0" 
              value={createProductData.version}
              onChange={(e) => setCreateProductData(prev => ({ ...prev, version: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={creatingProduct}
          >
            Cancel
          </Button>
          <ConditionalRender permission="products.create" fallback={null}>
            <Button 
              onClick={handleCreateProduct}
              disabled={creatingProduct || !createProductData.name.trim()}
            >
              {creatingProduct ? 'Creating...' : 'Create Product'}
            </Button>
          </ConditionalRender>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProductDialog;