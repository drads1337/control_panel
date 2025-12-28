import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CreateProductDialog: React.FC<CreateProductDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <p className="text-muted-foreground">Create Product Dialog is being implemented...</p>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProductDialog;

