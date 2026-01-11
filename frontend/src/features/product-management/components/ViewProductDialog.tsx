import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Upload, DollarSign, Bell, FileText, Shield, X } from 'lucide-react'
import type { Product } from '@/entities/product'
import { cn } from '@/lib/utils.ts'

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateString
  }
}

interface ViewProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onEdit?: (product: Product) => void
  onUpload?: (product: Product) => void
  onPrices?: (product: Product) => void
  onNotifications?: (product: Product) => void
  onChangelog?: (product: Product) => void
  onLibraryHash?: (product: Product) => void
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
  onLibraryHash,
  canUploadFiles = false,
  canManagePrices = false,
  canManageNotifications = false,
  canManageChangelog = false,
}: ViewProductDialogProps) {
  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[380px] p-0 gap-0 overflow-hidden border-none shadow-xl">
        {/* Compact Header */}
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between bg-muted/10">
          <div className="flex items-center gap-2 overflow-hidden">
            <DialogTitle className="text-base font-semibold truncate">
              {product.name}
            </DialogTitle>
            {product.is_active && (
              <Badge 
                variant="default"
                className="h-5 px-1.5 text-[10px] uppercase tracking-wider flex-shrink-0"
              >
                Active
              </Badge>
            )}
          </div>
          {/* Close button handled by Dialog primitive usually, but custom one works too if needed */}
        </DialogHeader>

        <div className="p-4 space-y-4 text-sm">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-secondary/20 p-2 rounded-md">
              <p className="text-[10px] text-muted-foreground uppercase">Ver</p>
              <p className="font-mono font-medium">{product.version || '—'}</p>
            </div>
            <div className="bg-secondary/20 p-2 rounded-md">
              <p className="text-[10px] text-muted-foreground uppercase">Downloads</p>
              <p className="font-mono font-medium">{product.downloads || 0}</p>
            </div>
            <div className="bg-secondary/20 p-2 rounded-md">
              <p className="text-[10px] text-muted-foreground uppercase">Users</p>
              <p className="font-mono font-medium">{product.active_users || 0}</p>
            </div>
          </div>

          {/* Description (Truncated) */}
          {product.description && (
            <div className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
              {product.description}
            </div>
          )}

          {/* Key Details List */}
          <div className="space-y-2 pt-1">
            <InfoRow label="ID" value={product.id} mono />
            {product.description && (
              <InfoRow label="Description" value={product.description} />
            )}
            {product.created_at && (
              <InfoRow label="Created" value={formatDate(product.created_at)} />
            )}
            <InfoRow label="Multi App" value={product.is_multi_app ? 'Yes' : 'No'} />
            {product.login_type && (
              <InfoRow label="Login Type" value={product.login_type.replace('_', ' ')} capitalize />
            )}
            {product.custom_key_prefix && (
              <InfoRow label="Key Prefix" value={product.custom_key_prefix} mono />
            )}
          </div>
        </div>

        {/* Action Bar - Icon based for minimalism */}
        <div className="bg-muted/30 p-2 flex items-center justify-between border-t">
            <div className="flex items-center gap-1">
              {onEdit && (
                <ActionButton icon={Edit} onClick={() => onEdit(product)} title="Edit Details" />
              )}
              {onUpload && canUploadFiles && (
                <ActionButton icon={Upload} onClick={() => onUpload(product)} title="Upload Files" />
              )}
              {onPrices && canManagePrices && (
                <ActionButton icon={DollarSign} onClick={() => onPrices(product)} title="Manage Prices" />
              )}
              {onNotifications && canManageNotifications && (
                <ActionButton icon={Bell} onClick={() => onNotifications(product)} title="Notifications" />
              )}
              {onChangelog && canManageChangelog && (
                <ActionButton icon={FileText} onClick={() => onChangelog(product)} title="Changelog" />
              )}
              {onLibraryHash && (
                <ActionButton icon={Shield} onClick={() => onLibraryHash(product)} title="Library Hashes" />
              )}
            </div>
            
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs px-3">
              Close
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Helper components to keep main clean
function InfoRow({ label, value, mono = false, capitalize = false }: { label: string, value: string | number, mono?: boolean, capitalize?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-foreground", mono && "font-mono", capitalize && "capitalize")}>
        {value}
      </span>
    </div>
  )
}

function ActionButton({ icon: Icon, onClick, title }: { icon: any, onClick: () => void, title: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background"
      title={title}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}