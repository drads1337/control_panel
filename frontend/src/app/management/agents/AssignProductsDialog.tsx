import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { type Agent } from '@/entities/agent';
import { getProducts, getProductsAvailableForAssignment, type Product } from '@/entities/product';

const ProductItem = React.memo<{
  product: Product;
  isSelected: boolean;
  onToggle: (productId: number) => void;
  prefix: string;
  hoverClass: string;
}>(function ProductItem({ product, isSelected, onToggle, prefix, hoverClass }) {
  return (
    <div key={product.id} className={`flex items-center space-x-2 p-2 ${hoverClass} rounded-md`}>
      <Checkbox
        id={`${prefix}-product-${product.id}`}
        checked={isSelected}
        onCheckedChange={() => onToggle(product.id)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${prefix}-product-${product.id}`} className="font-medium cursor-pointer">
            {product.name}
          </Label>
          <Badge variant="outline" className="text-xs">
            {product.version}
          </Badge>
          {product.is_multi_app ? (
            <Badge variant="default" className="text-xs">
              Multi-App
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Library
            </Badge>
          )}
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
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-2">
      <Checkbox
        id={checkboxId}
        checked={isChecked}
        onCheckedChange={onToggle}
      />
      <Label htmlFor={checkboxId} className="text-sm font-medium">
        {title} ({count})
      </Label>
    </div>
    <Badge variant={badgeVariant}>
      {selectedCount} selected
    </Badge>
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Assign Products to Agent</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Select products to assign to this agent. Products already assigned to other agents are not available for assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {assignedProducts.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                title="Remove Assigned"
                count={assignedProducts.length}
                selectedCount={selectedAssignedProducts.length}
                checkboxId="select-all-assigned"
                isChecked={selectedAssignedProducts.length === assignedProducts.length && assignedProducts.length > 0}
                onToggle={handleSelectAllAssigned}
                badgeVariant="secondary"
              />

              <ScrollArea className="h-32 border rounded-md p-3">
                <div className="space-y-1">
                  {assignedProducts.map((product) => (
                    <ProductItem
                      key={product.id}
                      product={product}
                      isSelected={selectedAssignedProducts.includes(product.id)}
                      onToggle={handleAssignedProductToggle}
                      prefix="assigned"
                      hoverClass="hover:bg-muted"
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="space-y-3">
            <SectionHeader
              title="Assign Available"
              count={availableProducts.length}
              selectedCount={selectedProducts.length}
              checkboxId="select-all"
              isChecked={selectedProducts.length === availableProducts.length && availableProducts.length > 0}
              onToggle={handleSelectAll}
              badgeVariant="secondary"
            />

            <ScrollArea className="h-32 border rounded-md p-3">
              {loading ? (
                <div className="text-center py-8">
                  <Spinner className="h-6 w-6 mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading products...</p>
                </div>
              ) : availableProducts.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No available products for assignment</p>
                  <p className="text-xs mt-1">All multi-app products are already assigned to agents. A product can only be assigned to one agent at a time.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {availableProducts.map((product) => (
                    <ProductItem
                      key={product.id}
                      product={product}
                      isSelected={selectedProducts.includes(product.id)}
                      onToggle={handleProductToggle}
                      prefix="product"
                      hoverClass="hover:bg-muted"
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            {selectedAssignedProducts.length > 0 && onUnassign && (
              <Button
                variant="destructive"
                onClick={handleUnassign}
                disabled={unassigning}
              >
                {unassigning ? (<><Spinner className="mr-2 h-4 w-4 animate-spin" />Removing...</>) : `Remove ${selectedAssignedProducts.length} Products`}
              </Button>
            )}
            {selectedProducts.length > 0 && (
              <Button
                onClick={handleAssign}
                disabled={assigning}
              >
                {assigning ? (<><Spinner className="mr-2 h-4 w-4 animate-spin" />Assigning...</>) : `Assign ${selectedProducts.length} Products`}
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignProductsDialog;
