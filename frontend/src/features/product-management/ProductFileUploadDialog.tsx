import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { Product } from '@/entities/product';

interface ProductFileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSuccess?: () => void;
}

const ProductFileUploadDialog: React.FC<ProductFileUploadDialogProps> = ({ open, onOpenChange, product, onSuccess }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <p className="text-muted-foreground">Product File Upload Dialog is being implemented...</p>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFileUploadDialog;

