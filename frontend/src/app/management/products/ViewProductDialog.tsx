import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Edit, Upload } from 'lucide-react';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { useProductPermissions } from '@/hooks/use-product-permissions';
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
            {product.description || 'No description'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Version</span>
              <span className="text-sm">{product.version}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Type</span>
              <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium">
                {product.is_multi_app ? 'Multi-App' : 'Product Library'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Login Type</span>
              <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium">
                {product.login_type === 'classic_login' ? 'Classic Login' : 'License Generation'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Status</span>
              {getStatusBadge(product.status)}
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Downloads</span>
              <span className="text-sm">{product.downloads.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Active Users</span>
              <span className="text-sm">{(product.activeUsers || product.active_users || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-muted-foreground">Date Created</span>
              <span className="text-sm">
                {product.created_at ? new Date(product.created_at).toLocaleDateString() : 'N/A'}
              </span>
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