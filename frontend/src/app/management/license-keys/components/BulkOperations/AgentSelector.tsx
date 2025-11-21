import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Database } from 'lucide-react';

interface AgentSelectorProps {
  agents: Array<{ id: number; name: string }>;
  agentId: string;
  selectedProducts: number[];
  availableProducts: Array<{ id: number; name: string }>;
  agentsLoading: boolean;
  onAgentChange: (agentId: string) => void;
  onProductsChange: (productIds: number[]) => void;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  agents,
  agentId,
  selectedProducts,
  availableProducts,
  agentsLoading,
  onAgentChange,
  onProductsChange,
}) => {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allProductIds = availableProducts.map(product => product.id);
      onProductsChange(allProductIds);
    } else {
      onProductsChange([]);
    }
  };

  const handleProductToggle = (productId: number, checked: boolean) => {
    if (checked) {
      onProductsChange([...selectedProducts, productId]);
    } else {
      onProductsChange(selectedProducts.filter(id => id !== productId));
    }
  };

  const allSelected = availableProducts.length > 0 && selectedProducts.length === availableProducts.length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Agent</Label>
        <Select value={agentId} onValueChange={onAgentChange} disabled={agentsLoading}>
          <SelectTrigger>
            <SelectValue placeholder={agentsLoading ? "Loading agents..." : "Select an agent"} />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id.toString()}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {agentId && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Select Products</Label>
          {availableProducts.length === 0 ? (
            <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
              <div className="text-center">
                <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Create the product</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all-bulk-ops-products"
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all-bulk-ops-products" className="text-sm font-medium">All Products</Label>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {availableProducts.map(product => (
                  <div key={product.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bulk-ops-product-${product.id}`}
                      checked={selectedProducts.includes(product.id)}
                      onCheckedChange={(checked) => handleProductToggle(product.id, checked as boolean)}
                    />
                    <Label htmlFor={`bulk-ops-product-${product.id}`} className="text-sm font-normal">
                      {product.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
