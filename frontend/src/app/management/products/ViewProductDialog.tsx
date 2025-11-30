import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Edit, Upload } from 'lucide-react';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { useProductPermissions } from '@/hooks/use-product-permissions';
import { sanitizeString } from '@/lib/sanitization';
import type { Product } from '@/entities/product';

interface ViewProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onEdit: (product: Product) => void;
  onUpload: (product: Product) => void;
}

const ViewProductDialog: React.FC<ViewProductDialogProps> = ({
  open,
  onOpenChange,
  product,
  onEdit,
  onUpload,
}) => {
  const { canViewProducts } = useProductPermissions();

  if (!product || !canViewProducts) return null;

  const getStatusBadge = (status: string) => {
    const statusType = status as StatusType;
    return (
      <span className={getStatusClasses(statusType)}>
        {getStatusText(statusType)}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            {product.name}
          </DialogTitle>
          <DialogDescription>
            {product.description ? sanitizeString(product.description) : 'No description'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Version</span>
              <div className="font-medium mt-0.5">{product.version}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <div className="mt-0.5">{getStatusBadge(product.status)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Downloads</span>
              <div className="font-medium mt-0.5">{product.downloads.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Users</span>
              <div className="font-medium mt-0.5">{(product.activeUsers || product.active_users || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">ID: {product.id}</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ViewProductDialog;