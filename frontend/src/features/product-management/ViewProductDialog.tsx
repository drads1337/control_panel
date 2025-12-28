import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { Product } from '@/entities/product';

interface ViewProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onEdit?: (product: Product) => void;
  onUpload?: (product: Product) => void;
}

const ViewProductDialog: React.FC<ViewProductDialogProps> = ({ open, onOpenChange, product, onEdit, onUpload }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <p className="text-muted-foreground">View Product Dialog is being implemented...</p>
      </DialogContent>
    </Dialog>
  );
};

export default ViewProductDialog;

