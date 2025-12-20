import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Database, 
  Users, 
  Box, 
  CheckSquare, 
  Square,
  Search
} from 'lucide-react';

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
  const isIndeterminate = selectedProducts.length > 0 && selectedProducts.length < availableProducts.length;

  return (
    <div className="grid gap-5">
      {/* Agent Selection Section */}
      <div className="space-y-2.5">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Target Agent
        </Label>
        <Select value={agentId} onValueChange={onAgentChange} disabled={agentsLoading}>
          <SelectTrigger className="w-full transition-all hover:bg-accent/5">
            <SelectValue placeholder={agentsLoading ? "Loading agents..." : "Select an agent to configure"} />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id.toString()}>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  {agent.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Selection Section */}
      <div className={cn(
        "space-y-3 transition-all duration-300 ease-in-out",
        agentId ? "opacity-100 translate-y-0" : "opacity-50 translate-y-2 pointer-events-none grayscale"
      )}>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Box className="h-4 w-4 text-muted-foreground" />
            Assign Products
          </Label>
          {selectedProducts.length > 0 && (
            <Badge variant="secondary" className="text-xs font-normal">
              {selectedProducts.length} selected
            </Badge>
          )}
        </div>

        {availableProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-lg bg-muted/30 text-center animate-in fade-in zoom-in-95">
            <div className="p-3 bg-background rounded-full shadow-sm mb-3">
              <Database className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="text-sm font-medium mb-1">No Products Available</h4>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Create products in the database to assign them here.
            </p>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
            {/* Control Bar */}
            <div className="flex items-center p-3 bg-muted/40 border-b gap-3">
              <Checkbox
                id="select-all-products"
                checked={allSelected || (isIndeterminate ? "indeterminate" : false)}
                onCheckedChange={handleSelectAll}
                className="data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary"
              />
              <Label 
                htmlFor="select-all-products" 
                className="text-sm font-medium cursor-pointer select-none flex-1"
              >
                {allSelected ? "Deselect All" : "Select All Products"}
              </Label>
            </div>

            {/* Scrollable Grid */}
            <ScrollArea className="h-[220px] p-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableProducts.map(product => {
                  const isSelected = selectedProducts.includes(product.id);
                  return (
                    <label
                      key={product.id}
                      htmlFor={`product-${product.id}`}
                      className={cn(
                        "flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-sm",
                        isSelected 
                          ? "bg-primary/5 border-primary/50" 
                          : "bg-background border-border hover:bg-accent/50"
                      )}
                    >
                      <Checkbox
                        id={`product-${product.id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleProductToggle(product.id, checked as boolean)}
                        className="mt-0.5"
                      />
                      <div className="space-y-1 leading-none">
                        <span className={cn(
                          "text-sm font-medium block",
                          isSelected ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {product.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-sans">
                          ID: {product.id}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};