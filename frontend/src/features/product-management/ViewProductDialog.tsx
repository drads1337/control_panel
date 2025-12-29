import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Edit, Upload, DollarSign, Bell, FileText } from 'lucide-react'
import type { Product } from '@/entities/product'

interface ViewProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onEdit?: (product: Product) => void
  onUpload?: (product: Product) => void
  onPrices?: (product: Product) => void
  onNotifications?: (product: Product) => void
  onChangelog?: (product: Product) => void
  canUploadFiles?: boolean
  canManagePrices?: boolean
  canManageNotifications?: boolean
  canManageChangelog?: boolean
}

export default function ViewProductDialog({
  open,
  onOpenChange,
  product,
  onEdit,
  onUpload,
  onPrices,
  onNotifications,
  onChangelog,
  canUploadFiles = false,
  canManagePrices = false,
  canManageNotifications = false,
  canManageChangelog = false,
}: ViewProductDialogProps) {
  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">
            {product.name}
          </DialogTitle>
          <DialogDescription className="text-sm mt-1">
            Product Details
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge 
                  variant={product.is_active ? "default" : "secondary"}
                  className="text-xs"
                >
                  {product.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Version</p>
                <p className="text-sm font-medium">{product.version || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Downloads</p>
                <p className="text-sm font-medium">{product.downloads || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Active Users</p>
                <p className="text-sm font-medium">{product.active_users || 0}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Description */}
          {product.description && (
            <>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Description
                </h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Product Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Multi App</p>
                <Badge variant={product.is_multi_app ? "default" : "outline"} className="text-xs">
                  {product.is_multi_app ? 'Yes' : 'No'}
                </Badge>
              </div>
              {product.login_type && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Login Type</p>
                  <p className="text-sm font-medium capitalize">
                    {product.login_type.replace('_', ' ')}
                  </p>
                </div>
              )}
              {product.custom_key_prefix && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Key Prefix</p>
                  <p className="text-sm font-mono font-medium">{product.custom_key_prefix}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-4 border-t flex-shrink-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(product)}
                className="text-xs h-8"
              >
                <Edit className="h-3 w-3 mr-1.5" />
                Edit
              </Button>
            )}
            {onUpload && canUploadFiles && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUpload(product)}
                className="text-xs h-8"
              >
                <Upload className="h-3 w-3 mr-1.5" />
                Upload Files
              </Button>
            )}
            {onPrices && canManagePrices && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPrices(product)}
                className="text-xs h-8"
              >
                <DollarSign className="h-3 w-3 mr-1.5" />
                Manage Prices
              </Button>
            )}
            {onNotifications && canManageNotifications && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNotifications(product)}
                className="text-xs h-8"
              >
                <Bell className="h-3 w-3 mr-1.5" />
                Notifications
              </Button>
            )}
            {onChangelog && canManageChangelog && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChangelog(product)}
                className="text-xs h-8"
              >
                <FileText className="h-3 w-3 mr-1.5" />
                Changelog
              </Button>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full text-xs h-8"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
