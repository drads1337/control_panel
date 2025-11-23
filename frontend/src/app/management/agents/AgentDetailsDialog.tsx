import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { sanitizeString } from '@/lib/sanitization';
import type { Product } from '@/entities/product';
import type { Agent } from '@/entities/agent';
import { Package } from 'lucide-react';

interface AgentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  products: Product[];
}

const AgentDetailsDialog: React.FC<AgentDetailsDialogProps> = ({ open, onOpenChange, agent, products }) => {
  if (!agent) return null;

  const assignedProducts = agent.assigned_products.map(productId => 
    products.find(p => p.id === productId)
  ).filter(Boolean) as Product[];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100/80">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 hover:bg-yellow-100/80">Maintenance</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base sm:text-lg break-words pr-4">
                {sanitizeString(agent.name)}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs sm:text-sm">
                {agent.description ? sanitizeString(agent.description) : 'No description available'}
              </DialogDescription>
            </div>
            <div className="flex-shrink-0">
              {getStatusBadge(agent.status)}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-medium">v{agent.version}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Downloads</span>
              <span className="text-sm font-medium">{agent.downloads.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Active Users</span>
              <span className="text-sm font-medium">{agent.active_users.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm font-medium">
                {agent.created_at ? new Date(agent.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50 sm:col-span-2">
              <span className="text-sm text-muted-foreground">Last Updated</span>
              <span className="text-sm font-medium">
                {agent.updated_at ? new Date(agent.updated_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Assigned Products Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Assigned Products</h3>
              <Badge variant="outline" className="text-xs">
                {assignedProducts.length}
              </Badge>
            </div>
            
            {assignedProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assignedProducts.map((product) => (
                  <div key={product.id} className="flex items-start gap-3 p-3 border rounded-lg bg-card/50">
                    {product.logo ? (
                      <img src={product.logo} alt={product.name} className="w-8 h-8 rounded object-contain bg-background" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{sanitizeString(product.name)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>v{product.version}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        <span className="capitalize">{product.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic py-2">
                No products assigned to this agent.
              </div>
            )}
          </div>

          {/* Long Text Sections */}
          {(agent.changelog || agent.notifications) && (
            <div className="space-y-6">
              {agent.changelog && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Changelog</span>
                  <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md whitespace-pre-wrap max-h-[200px] overflow-y-auto border">
                    {sanitizeString(agent.changelog)}
                  </div>
                </div>
              )}
              
              {agent.notifications && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Notifications</span>
                  <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md whitespace-pre-wrap max-h-[200px] overflow-y-auto border">
                    {sanitizeString(agent.notifications)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentDetailsDialog;