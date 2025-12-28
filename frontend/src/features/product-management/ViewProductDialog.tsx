"use client"

import * as React from "react"
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { sanitizeString } from '@/lib/sanitization';
import { useProductPermissions } from './hooks/use-product-permissions';
import type { Product } from '@/entities/product';

interface ViewProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onEdit?: (product: Product) => void;
  onUpload?: (product: Product) => void;
}

export default function ViewProductDialog({
  open,
  onOpenChange,
  product,
  onEdit,
  onUpload,
}: ViewProductDialogProps) {
  const { canViewProducts } = useProductPermissions();

  if (!product || !canViewProducts) return null;

  const getStatusBadge = (status: string) => {
    const statusType = status as StatusType;
    return (
      <Badge variant="outline" className={`text-xs h-5 px-1.5 ${getStatusClasses(statusType)}`}>
        {getStatusText(statusType)}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-3">
            Name: <span className="font-medium">{product.name}</span>
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {product.description ? sanitizeString(product.description) : 'No description'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">Version</span>
              <span className="text-xs">{product.version}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <Badge variant="outline" className="text-xs h-5 px-1.5">
                {product.is_multi_app ? 'Multi-App' : 'Product Library'}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">Login Type</span>
              <Badge variant="outline" className="text-xs h-5 px-1.5">
                {product.login_type === 'classic_login' ? 'Classic Login' : 'License Generation'}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              {getStatusBadge(product.status)}
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">Downloads</span>
              <span className="text-xs">{product.downloads.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">Active Users</span>
              <span className="text-xs">{(product.activeUsers || product.active_users || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs font-medium text-muted-foreground">Date Created</span>
              <span className="text-xs">
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
}

