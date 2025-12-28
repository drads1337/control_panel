import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { Product } from '@/entities/product';

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSuccess?: () => void;
}

const EditProductDialog: React.FC<EditProductDialogProps> = ({ open, onOpenChange, product, onSuccess }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <p className="text-muted-foreground">Edit Product Dialog is being implemented...</p>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;

