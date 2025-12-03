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
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-medium break-words pr-4">
                {sanitizeString(agent.name)}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {agent.description ? sanitizeString(agent.description) : 'No description available'}
              </DialogDescription>
            </div>
            <div className="flex-shrink-0">
              {getStatusBadge(agent.status)}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Version</span>
              <div className="text-xs font-medium">v{agent.version}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Downloads</span>
              <div className="text-xs font-medium">{agent.downloads.toLocaleString()}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Active Users</span>
              <div className="text-xs font-medium">{agent.active_users.toLocaleString()}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Created</span>
              <div className="text-xs font-medium">
                {agent.created_at ? new Date(agent.created_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>

          {assignedProducts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium">Assigned Products</h3>
                <Badge variant="outline" className="text-xs h-5">
                  {assignedProducts.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {assignedProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-1.5 p-1.5 border rounded text-xs">
                    {product.logo ? (
                      <img src={product.logo} alt={product.name} className="w-5 h-5 rounded object-contain" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-2.5 w-2.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{sanitizeString(product.name)}</div>
                      <div className="text-xs text-muted-foreground">v{product.version}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(agent.changelog || agent.notifications) && (
            <div className="space-y-3">
              {agent.changelog && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">Changelog</span>
                  <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded border max-h-[150px] overflow-y-auto">
                    {sanitizeString(agent.changelog)}
                  </div>
                </div>
              )}
              {agent.notifications && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">Notifications</span>
                  <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded border max-h-[150px] overflow-y-auto">
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