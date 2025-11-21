import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Database, Container } from 'lucide-react';
import { useKeyForm } from '../hooks/use-key-form';
import { durationOptions, parseDuration } from '../hooks/use-duration';
import { ConditionalRender } from '@/components/rbac/conditional-render';

interface BulkKeyFormProps {
  products: Array<{ id: number; name: string; is_multi_app: boolean }>;
  agents: Array<{ id: number; name: string; assigned_products: number[] }>;
  agentsLoading: boolean;
  onSubmit: (data: {
    targetType: 'product' | 'agent';
    productId?: number;
    agentId?: number;
    selectedProducts?: number[];
    quantity: number;
    duration_hours: number;
    max_devices: number;
  }) => Promise<void>;
  loading: boolean;
  canViewProducts: boolean;
  canViewAgents: boolean;
}

export const BulkKeyForm: React.FC<BulkKeyFormProps> = ({
  products,
  agents,
  agentsLoading,
  onSubmit,
  loading,
  canViewProducts,
  canViewAgents,
}) => {
  const showTargetTypeToggle = canViewProducts && canViewAgents;

  const getInitialTargetType = () => {
    if (canViewProducts && !canViewAgents) return 'product';
    if (canViewAgents && !canViewProducts) return 'agent';
    return 'product';
  };

  const {
    formData,
    updateField,
    getProductLibraryProducts,
    getAssignedProductsForAgent,
    reset,
  } = useKeyForm({
    products,
    agents,
    initialTargetType: getInitialTargetType(),
  });

  React.useEffect(() => {
    if (!showTargetTypeToggle) {
      if (canViewProducts && !canViewAgents && formData.targetType !== 'product') {
        updateField('targetType', 'product');
      } else if (canViewAgents && !canViewProducts && formData.targetType !== 'agent') {
        updateField('targetType', 'agent');
      }
    }
  }, [showTargetTypeToggle, canViewProducts, canViewAgents, formData.targetType, updateField]);

  const [quantity, setQuantity] = React.useState(10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (quantity < 1 || quantity > 1000) {
      throw new Error('Quantity must be between 1 and 1000');
    }

    const duration_hours = parseDuration(formData.duration, formData.customHours);

    if (formData.targetType === 'agent') {
      if (!formData.agentId || formData.selectedProducts.length === 0) {
        throw new Error('Please select a agent and at least one product');
      }

      const promises = formData.selectedProducts.map(productId =>
        onSubmit({
          targetType: 'agent',
          agentId: parseInt(formData.agentId),
          selectedProducts: formData.selectedProducts,
          quantity,
          duration_hours,
          max_devices: formData.maxDevices,
        })
      );
      await Promise.all(promises);
    } else {
      if (!formData.productId) {
        throw new Error('Please select a product');
      }
      await onSubmit({
        targetType: 'product',
        productId: parseInt(formData.productId),
        quantity,
        duration_hours,
        max_devices: formData.maxDevices,
      });
    }

    reset();
    setQuantity(10);
  };

  return (
    <ConditionalRender permission="keys.generate" fallback={null}>
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Create Bulk Keys</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Create multiple license keys at once (up to 1000 keys per batch).
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 -mt-3">
          <form onSubmit={handleSubmit} className="space-y-4">
            {showTargetTypeToggle && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Target Type</Label>
                <ToggleGroup
                  type="single"
                  value={formData.targetType}
                  onValueChange={(value) => value && updateField('targetType', value as 'product' | 'agent')}
                  className="grid grid-cols-2 w-full"
                >
                  <ToggleGroupItem value="product" className="flex items-center justify-center gap-2 h-10 text-sm font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted hover:border-muted-foreground/20 transition-colors">
                    <Database className="h-4 w-4" />
                    Product
                  </ToggleGroupItem>
                  <ToggleGroupItem value="agent" className="flex items-center justify-center gap-2 h-10 text-sm font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted hover:border-muted-foreground/20 transition-colors">
                    <Container className="h-4 w-4" />
                    Agent
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}

            {canViewProducts && (formData.targetType === 'product' || !canViewAgents) ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Product</Label>
                {getProductLibraryProducts().length === 0 ? (
                  products.length === 0 ? (
                  <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
                    <div className="text-center">
                      <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No products available. Create an product first.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
                      <div className="text-center">
                        <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">You only have access to multi-app products. Use Agent target type to create keys for them.</p>
                    </div>
                  </div>
                  )
                ) : (
                  <div className="flex gap-2 items-center">
                    <Select
                      value={formData.productId}
                      onValueChange={(value) => updateField('productId', value)}
                      disabled={loading}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {getProductLibraryProducts().map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateField('productId', '')}
                      disabled={loading}
                      className="h-10 w-10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ) : ((formData.targetType === 'agent' && canViewAgents) || (canViewAgents && !canViewProducts)) ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Agent</Label>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={formData.agentId}
                      onValueChange={(value) => {
                        updateField('agentId', value);
                        updateField('selectedProducts', []);
                      }}
                      disabled={loading || agentsLoading}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={agentsLoading ? "Loading agents..." : "Select a agent"} />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id.toString()}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        updateField('agentId', '');
                        updateField('selectedProducts', []);
                      }}
                      disabled={loading}
                      className="h-10 w-10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {formData.agentId && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Select Products</Label>
                    {getAssignedProductsForAgent(parseInt(formData.agentId)).length === 0 ? (
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
                            id="select-all-bulk-products"
                            checked={formData.selectedProducts.length === getAssignedProductsForAgent(parseInt(formData.agentId)).length && getAssignedProductsForAgent(parseInt(formData.agentId)).length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const allProductIds = getAssignedProductsForAgent(parseInt(formData.agentId)).map(product => product.id);
                                updateField('selectedProducts', allProductIds);
                              } else {
                                updateField('selectedProducts', []);
                              }
                            }}
                          />
                          <Label htmlFor="select-all-bulk-products" className="text-sm font-medium">All Products</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                          {getAssignedProductsForAgent(parseInt(formData.agentId)).map(product => (
                            <div key={product.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`bulk-product-${product.id}`}
                                checked={formData.selectedProducts.includes(product.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    updateField('selectedProducts', [...formData.selectedProducts, product.id]);
                                  } else {
                                    updateField('selectedProducts', formData.selectedProducts.filter(id => id !== product.id));
                                  }
                                }}
                              />
                              <Label htmlFor={`bulk-product-${product.id}`} className="text-sm font-normal">{product.name}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Number of Keys</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                min="1"
                max="1000"
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">Maximum 100 keys per batch</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Duration</Label>
              <div className="grid grid-cols-5 gap-2">
                {durationOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.duration === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      updateField('duration', option.value);
                      updateField('customHours', '');
                    }}
                    disabled={loading}
                    className="text-xs"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Or Custom Hours</Label>
                <Input
                  type="number"
                  placeholder="e.g., 48"
                  value={formData.customHours}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateField('customHours', value);
                    if (value) {
                      updateField('duration', '');
                    }
                  }}
                  disabled={loading}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Max. Devices</Label>
                <Input
                  type="number"
                  value={formData.maxDevices}
                  onChange={(e) => updateField('maxDevices', parseInt(e.target.value) || 1)}
                  disabled={loading}
                  min="1"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={loading || (formData.targetType === 'product' ? !formData.productId : !formData.agentId || formData.selectedProducts.length === 0)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {loading ? 'Creating...' : `Create ${quantity} Keys`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </ConditionalRender>
  );
};
