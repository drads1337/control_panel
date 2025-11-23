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
        "flex items-center space-x-3 p-3 transition-colors active:bg-accent/50",
        isSelected ? "bg-accent/30" : "hover:bg-muted/50"
      )}
      onClick={() => onToggle(product.id)}
    >
      <Checkbox
        id={`${prefix}-product-${product.id}`}
        checked={isSelected}
        onCheckedChange={() => onToggle(product.id)}
        className="h-5 w-5 border-muted-foreground/40"
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <Label 
            htmlFor={`${prefix}-product-${product.id}`} 
            className="font-medium cursor-pointer text-sm sm:text-base truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {product.name}
          </Label>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
              v{product.version}
            </Badge>
            {product.is_multi_app ? (
              <Badge variant="default" className="text-[10px] h-5 px-1.5">
                Multi-App
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                Library
              </Badge>
            )}
          </div>
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
        className="h-4 w-4"
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
}

const AssignProductsDialog: React.FC<AssignProductsDialogProps> = ({
  open,
  onOpenChange,
  agent,
  onAssign,
  onUnassign,
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
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-base sm:text-lg">Assign Products</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Manage product assignments for this agent.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Assigned Products Section */}
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

              <div className="border rounded-md divide-y overflow-hidden bg-card">
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

          {/* Available Products Section */}
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

            <div className="border rounded-md overflow-hidden bg-card min-h-[100px]">
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

        <DialogFooter className="p-4 border-t bg-background flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {selectedAssignedProducts.length > 0 && onUnassign && (
              <Button
                variant="destructive"
                onClick={handleUnassign}
                disabled={unassigning}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                {unassigning ? (
                  <><Spinner className="mr-2 h-4 w-4 animate-spin" />Removing...</>
                ) : (
                  `Remove (${selectedAssignedProducts.length})`
                )}
              </Button>
            )}
            
            {selectedProducts.length > 0 && (
              <Button
                onClick={handleAssign}
                disabled={assigning}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {assigning ? (
                  <><Spinner className="mr-2 h-4 w-4 animate-spin" />Assigning...</>
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