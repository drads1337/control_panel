import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { type Agent } from '@/entities/agent';
import { getProducts, getProductsAvailableForAssignment, type Product } from '@/entities/product';
import { cn } from '@/lib/utils';

const ProductItem = React.memo<{
  product: Product;
  isSelected: boolean;
  onToggle: (productId: number) => void;
  prefix: string;
}>(function ProductItem({ product, isSelected, onToggle, prefix }) {
  return (
    <div 
      className={cn(
        "flex items-center gap-2 p-2 transition-colors cursor-pointer",
        isSelected ? "bg-accent/20" : "hover:bg-muted/20"
      )}
      onClick={() => onToggle(product.id)}
    >
      <Checkbox
        id={`${prefix}-product-${product.id}`}
        checked={isSelected}
        onCheckedChange={() => onToggle(product.id)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Label 
            htmlFor={`${prefix}-product-${product.id}`} 
            className="font-medium cursor-pointer text-xs truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {product.name}
          </Label>
          <Badge variant="outline" className="text-xs h-4 px-1 font-normal">
            v{product.version}
          </Badge>
        </div>
      </div>
    </div>
  );
});

const SectionHeader: React.FC<{
  title: string;
  count: number;
  selectedCount: number;
  checkboxId: string;
  isChecked: boolean;
  onToggle: () => void;
  badgeVariant: "destructive" | "secondary";
}> = ({ title, count, selectedCount, checkboxId, isChecked, onToggle, badgeVariant }) => (
  <div className="flex items-center justify-between py-1">
    <div className="flex items-center space-x-2">
      <Checkbox
        id={checkboxId}
        checked={isChecked}
        onCheckedChange={onToggle}
      />
      <Label htmlFor={checkboxId} className="text-sm font-medium cursor-pointer">
        {title} ({count})
      </Label>
    </div>
    {selectedCount > 0 && (
      <Badge variant={badgeVariant} className="text-xs">
        {selectedCount} selected
      </Badge>
    )}
  </div>
);

interface AssignProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onAssign: (agentId: number, productIds: number[]) => Promise<void>;
  onUnassign?: (agentId: number, productIds: number[]) => Promise<void>;
  onSuccess?: () => void;
}

const AssignProductsDialog: React.FC<AssignProductsDialogProps> = ({
  open,
  onOpenChange,
  agent,
  onAssign,
  onUnassign,
  onSuccess,
}) => {
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [assignedProducts, setAssignedProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [selectedAssignedProducts, setSelectedAssignedProducts] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  useEffect(() => {
    if (open && agent) {
      loadAvailableProducts();
      loadAssignedProducts();
    }
  }, [open, agent]);

  const loadAvailableProducts = async () => {
    setLoading(true);
    try {
      const response = await getProductsAvailableForAssignment(1, 100);
      setAvailableProducts(response.products || []);
    } catch (error) {
      setAvailableProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedProducts = async () => {
    if (!agent?.assigned_products || agent.assigned_products.length === 0) {
      setAssignedProducts([]);
      return;
    }
    try {
      const response = await getProducts('all');
      const allProducts = response.products || [];
      const assigned = allProducts.filter(product => 
        agent.assigned_products.includes(product.id)
      );
      setAssignedProducts(assigned);
    } catch (error) {
      setAssignedProducts([]);
    }
  };

  const handleProductToggle = (productId: number) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === availableProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(availableProducts.map(product => product.id));
    }
  };

  const handleAssignedProductToggle = (productId: number) => {
    setSelectedAssignedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAllAssigned = () => {
    if (selectedAssignedProducts.length === assignedProducts.length) {
      setSelectedAssignedProducts([]);
    } else {
      setSelectedAssignedProducts(assignedProducts.map(product => product.id));
    }
  };

  const handleAssign = async () => {
    if (!agent || selectedProducts.length === 0) return;
    setAssigning(true);
    try {
      await onAssign(agent.id, selectedProducts);
      setSelectedProducts([]);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    if (!agent || selectedAssignedProducts.length === 0 || !onUnassign) return;
    setUnassigning(true);
    try {
      await onUnassign(agent.id, selectedAssignedProducts);
      setSelectedAssignedProducts([]);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setUnassigning(false);
    }
  };

  const handleClose = () => {
    setSelectedProducts([]);
    setSelectedAssignedProducts([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b flex-shrink-0">
          <DialogTitle className="text-sm font-medium">Assign Products</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">
            Manage product assignments for this agent.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {assignedProducts.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                title="Currently Assigned"
                count={assignedProducts.length}
                selectedCount={selectedAssignedProducts.length}
                checkboxId="select-all-assigned"
                isChecked={selectedAssignedProducts.length === assignedProducts.length && assignedProducts.length > 0}
                onToggle={handleSelectAllAssigned}
                badgeVariant="secondary"
              />
              <div className="border rounded-md divide-y">
                {assignedProducts.map((product) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    isSelected={selectedAssignedProducts.includes(product.id)}
                    onToggle={handleAssignedProductToggle}
                    prefix="assigned"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <SectionHeader
              title="Available for Assignment"
              count={availableProducts.length}
              selectedCount={selectedProducts.length}
              checkboxId="select-all"
              isChecked={selectedProducts.length === availableProducts.length && availableProducts.length > 0}
              onToggle={handleSelectAll}
              badgeVariant="secondary"
            />
            <div className="border rounded-md min-h-[100px]">
              {loading ? (
                <div className="text-center py-8">
                  <Spinner className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Loading products...</p>
                </div>
              ) : availableProducts.length === 0 ? (
                <div className="text-center py-8 px-4 text-muted-foreground">
                  <p className="text-sm font-medium">No available products</p>
                  <p className="text-xs mt-1 max-w-[250px] mx-auto">
                    All multi-app products are already assigned.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {availableProducts.map((product) => (
                    <ProductItem
                      key={product.id}
                      product={product}
                      isSelected={selectedProducts.includes(product.id)}
                      onToggle={handleProductToggle}
                      prefix="product"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-4 py-3 border-t flex-shrink-0 flex-col-reverse sm:flex-row gap-1.5">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="w-full sm:w-auto h-8 text-xs"
          >
            Cancel
          </Button>
          <div className="flex flex-col sm:flex-row gap-1.5 w-full sm:w-auto">
            {selectedAssignedProducts.length > 0 && onUnassign && (
              <Button
                variant="destructive"
                onClick={handleUnassign}
                disabled={unassigning}
                className="w-full sm:w-auto h-8 text-xs order-2 sm:order-1"
              >
                {unassigning ? (
                  <><Spinner className="mr-1.5 h-3.5 w-3.5 animate-spin" />Removing...</>
                ) : (
                  `Remove (${selectedAssignedProducts.length})`
                )}
              </Button>
            )}
            {selectedProducts.length > 0 && (
              <Button
                onClick={handleAssign}
                disabled={assigning}
                className="w-full sm:w-auto h-8 text-xs order-1 sm:order-2"
              >
                {assigning ? (
                  <><Spinner className="mr-1.5 h-3.5 w-3.5 animate-spin" />Assigning...</>
                ) : (
                  `Assign (${selectedProducts.length})`
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignProductsDialog;

