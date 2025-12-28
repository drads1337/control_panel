import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { X, Database } from 'lucide-react';
import { sanitizeString } from '@/lib/sanitization';

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

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Agent</Label>
        <div className="flex gap-1 items-center">
          <Select value={agentId} onValueChange={onAgentChange} disabled={agentsLoading}>
            <SelectTrigger className="flex-1 text-xs h-8">
              <SelectValue placeholder={agentsLoading ? "Loading..." : "Select Agent"} />
            </SelectTrigger>
            <SelectContent className="text-xs">
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id.toString()} className="text-xs">
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onAgentChange('');
              onProductsChange([]);
            }}
            disabled={agentsLoading}
            className="h-8 w-8 shrink-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {agentId && (
        <div className="pt-1">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Assigned Products</Label>
              {availableProducts.length > 0 && (
                <div className="flex items-center space-x-1">
                  <Checkbox
                    id="select-all-bulk-operations-products"
                    className="h-3 w-3"
                    checked={selectedProducts.length === availableProducts.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all-bulk-operations-products" className="text-[10px] cursor-pointer text-muted-foreground">Select All</Label>
                </div>
              )}
            </div>

            {availableProducts.length === 0 ? (
              <div className="p-2 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20 text-center text-xs text-muted-foreground">
                Agent has no assigned products
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto border rounded-md p-1.5 bg-muted/10">
                {availableProducts.map(product => (
                  <div key={product.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded transition-colors">
                    <Checkbox
                      id={`bulk-operations-product-${product.id}`}
                      className="h-3 w-3"
                      checked={selectedProducts.includes(product.id)}
                      onCheckedChange={(checked) => handleProductToggle(product.id, checked as boolean)}
                    />
                    <Label htmlFor={`bulk-operations-product-${product.id}`} className="text-xs cursor-pointer w-full truncate" title={sanitizeString(product.name)}>
                      {sanitizeString(product.name)}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

