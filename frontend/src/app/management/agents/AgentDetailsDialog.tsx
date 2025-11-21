import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Zap, Calendar, Download, Users, Database, FileText, Bell } from 'lucide-react';
import type { Product } from '@/entities/product';
import type { Agent } from '@/entities/agent';
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
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Maintenance</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            {agent.name}
          </DialogTitle>
          <DialogDescription>
            {agent.description || 'No description available'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Status</span>
              {getStatusBadge(agent.status)}
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Version</span>
              <span className="text-sm">v{agent.version}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Downloads</span>
              <span className="text-sm">{agent.downloads.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Active Users</span>
              <span className="text-sm">{agent.active_users.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Assigned Products</span>
              <span className="text-sm">{agent.assigned_products.length}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-muted-foreground">Creation Date</span>
              <span className="text-sm">
                {agent.created_at ? new Date(agent.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
          {}
          {assignedProducts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Assigned Products</h3>
              <div className="space-y-2">
                {assignedProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                      {product.logo ? (
                        <img src={product.logo} alt={product.name} className="w-6 h-6 rounded" />
                      ) : (
                        <Database className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Version: {product.version} | Status: {product.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {}
          {(agent.changelog || agent.notifications) && (
            <div className="space-y-3">
              {agent.changelog && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Changelog
                  </span>
                  <div className="mt-1 text-sm bg-muted p-3 rounded">{agent.changelog}</div>
                </div>
              )}
              {agent.notifications && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notifications
                  </span>
                  <div className="mt-1 text-sm bg-muted p-3 rounded">{agent.notifications}</div>
                </div>
              )}
            </div>
          )}
          {}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Last Updated
              </span>
              <span className="text-sm">
                {agent.updated_at ? new Date(agent.updated_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default AgentDetailsDialog;