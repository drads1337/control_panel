"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { sanitizeString } from '@/lib/sanitization';
import { useProductPermissions } from './hooks/use-product-permissions';
import type { Product } from '@/entities/product';
import { 
  Upload, 
  DollarSign, 
  Bell, 
  List as ListIcon,
  Shield,
  Cloud,
  Settings,
  Package,
  Database,
  Key,
  Activity,
  CreditCard,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ViewProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onEdit?: (product: Product) => void;
  onUpload?: (product: Product) => void;
  onPrices?: (product: Product) => void;
  onNotifications?: (product: Product) => void;
  onChangelog?: (product: Product) => void;
  canUploadFiles?: boolean;
  canManagePrices?: boolean;
  canManageNotifications?: boolean;
  canManageChangelog?: boolean;
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
  const { canViewProducts } = useProductPermissions();
  const [activeTab, setActiveTab] = useState<'details' | 'configuration'>('details');

  if (!product || !canViewProducts) return null;

  const getStatusBadge = (status: string) => {
    const statusType = status as StatusType;
    return (
      <span className={cn(getStatusClasses(statusType), "rounded-none")}>
        {getStatusText(statusType)}
      </span>
    );
  };

  const getIconForProduct = (product: Product) => {
    const icons = [Package, Database, Key, Settings, Cloud, Lock, CreditCard, Activity];
    return icons[product.id % icons.length];
  };

  const getIconColor = (product: Product) => {
    const colors = [
      'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
      'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
      'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
      'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
      'text-rose-500 bg-rose-50 dark:bg-rose-900/20',
    ];
    return colors[product.id % colors.length];
  };

  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const getTimeAgo = (date: string | null | undefined): string => {
    if (!date) return 'Just now';
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  const IconComponent = getIconForProduct(product);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[600px] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-1 border-b bg-muted/5 flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">
            Product Details
          </DialogTitle>
          <DialogDescription className="text-xs">
            Viewing information for product <span className="font-mono text-foreground">#{product.id}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as 'details' | 'configuration')} 
          className="flex-1 flex flex-col min-h-0 w-full"
        >
          <TabsList className="w-full rounded-none bg-transparent h-9 p-0 flex-shrink-0">
            <TabsTrigger 
              value="details" 
              className="flex-1 h-9 rounded-none text-xs data-[state=active]:bg-transparent"
            >
              Details
            </TabsTrigger>
            <TabsTrigger 
              value="configuration"
              className="flex-1 h-9 rounded-none text-xs data-[state=active]:bg-transparent"
            >
              Configuration
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <TabsContent value="details" className="mt-0 space-y-4">
              {/* Product Header */}
              <div className="flex items-start gap-4 pb-4 border-b">
                <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0", getIconColor(product))}>
                  <IconComponent className="size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground mb-1">{product.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {product.description ? sanitizeString(product.description) : 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/10 border rounded-md">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</span>
                  <div>{getStatusBadge(product.status)}</div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Version</span>
                  <p className="text-xs font-medium font-mono">v{product.version || '0.0.0'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</span>
                  <p className="text-xs font-medium">{product.is_multi_app ? 'Multi-App' : 'Product Library'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Login Type</span>
                  <p className="text-xs font-medium">{product.login_type === 'classic_login' ? 'Classic' : 'License'}</p>
                </div>
                
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Downloads</span>
                  <p className="text-xs font-medium">{formatNumber(product.downloads)}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Users</span>
                  <p className="text-xs font-medium">{(product.activeUsers || product.active_users || 0)}</p>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Created</span>
                  <p className="text-xs truncate">
                    {product.created_at ? new Date(product.created_at).toLocaleDateString() : '-'}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/10 border p-3 rounded-md text-center">
                  <div className="text-lg font-bold text-primary">
                    {formatNumber(product.downloads)}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">Downloads</div>
                </div>
                <div className="bg-muted/10 border p-3 rounded-md text-center">
                  <div className="text-lg font-bold text-primary">
                    {product.activeUsers || product.active_users || 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">Active Users</div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Recent Activity</Label>
                <div className="space-y-2 pl-2 border-l border-muted ml-2">
                  <div className="relative pl-6">
                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background bg-primary"></div>
                    <div className="text-xs text-foreground font-medium">Version {product.version || '0.0.0'} released</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{getTimeAgo(product.updated_at)}</div>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background bg-muted-foreground/30"></div>
                    <div className="text-xs text-foreground font-medium">Product updated</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{getTimeAgo(product.updated_at)}</div>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background bg-muted-foreground/30"></div>
                    <div className="text-xs text-foreground font-medium">Product created</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{getTimeAgo(product.created_at)}</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="configuration" className="mt-0 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Product Configuration</Label>
                <div className="border rounded-md divide-y">
                  {canUploadFiles && onUpload && (
                    <div 
                      onClick={() => {
                        onUpload(product);
                        onOpenChange(false);
                      }}
                      className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <Upload className="size-4 text-muted-foreground group-hover:text-foreground" />
                        <span className="text-sm text-foreground font-medium">Files</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Manage</span>
                    </div>
                  )}
                  {canManagePrices && onPrices && (
                    <div 
                      onClick={() => {
                        onPrices(product);
                        onOpenChange(false);
                      }}
                      className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <DollarSign className="size-4 text-muted-foreground group-hover:text-foreground" />
                        <span className="text-sm text-foreground font-medium">Pricing</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Configure</span>
                    </div>
                  )}
                  {canManageNotifications && onNotifications && (
                    <div 
                      onClick={() => {
                        onNotifications(product);
                        onOpenChange(false);
                      }}
                      className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="size-4 text-muted-foreground group-hover:text-foreground" />
                        <span className="text-sm text-foreground font-medium">Notifications</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Manage</span>
                    </div>
                  )}
                  {canManageChangelog && onChangelog && (
                    <div 
                      onClick={() => {
                        onChangelog(product);
                        onOpenChange(false);
                      }}
                      className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <ListIcon className="size-4 text-muted-foreground group-hover:text-foreground" />
                        <span className="text-sm text-foreground font-medium">Changelog</span>
                      </div>
                      <span className="text-xs text-muted-foreground">View</span>
            </div>
                  )}
                  <div className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <Shield className="size-4 text-muted-foreground group-hover:text-foreground" />
                      <span className="text-sm text-foreground font-medium">Security Level</span>
            </div>
                    <span className="text-xs text-muted-foreground">High</span>
            </div>
                  <div className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <Cloud className="size-4 text-muted-foreground group-hover:text-foreground" />
                      <span className="text-sm text-foreground font-medium">Cloud Sync</span>
            </div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Enabled</span>
            </div>
                  <div className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <Settings className="size-4 text-muted-foreground group-hover:text-foreground" />
                      <span className="text-sm text-foreground font-medium">API Limits</span>
            </div>
                    <span className="text-xs text-muted-foreground">Unlimited</span>
            </div>
          </div>
        </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-2 border-t bg-background flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full h-8 text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

