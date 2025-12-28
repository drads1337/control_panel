import React, { useEffect, FormEvent, useState } from 'react';
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
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { sanitizeString } from '@/lib/sanitization';

interface CustomKeyFormProps {
  products: Array<{ id: number; name: string; is_multi_app: boolean }>;
  agents: Array<{ id: number; name: string; assigned_products: number[] }>;
  agentsLoading: boolean;
  onSubmit: (data: {
    targetType: 'product' | 'agent';
    productId?: number;
    agentId?: number;
    selectedProducts?: number[];
    keyName: string;
    duration_hours: number;
    max_devices: number;
  }) => Promise<void>;
  loading: boolean;
  canViewProducts: boolean;
  canViewAgents: boolean;
}

export const CustomKeyForm: React.FC<CustomKeyFormProps> = ({
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

  useEffect(() => {
    if (!showTargetTypeToggle) {
      if (canViewProducts && !canViewAgents && formData.targetType !== 'product') {
        updateField('targetType', 'product');
      } else if (canViewAgents && !canViewProducts && formData.targetType !== 'agent') {
        updateField('targetType', 'agent');
      }
    }
  }, [showTargetTypeToggle, canViewProducts, canViewAgents, formData.targetType, updateField]);

  const [keyName, setKeyName] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!keyName.trim()) {
      throw new Error('Key name is required');
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
          keyName: `${keyName}-${Date.now()}-${productId}`,
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
        keyName: keyName || `CUSTOM-${Date.now()}`,
        duration_hours,
        max_devices: formData.maxDevices,
      });
    }

    reset();
    setKeyName('');
  };

  return (
    <ConditionalRender permission="keys.create" fallback={null}>
      <Card className="p-3">
        <CardHeader className="p-0 pb-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">Create Custom Key</CardTitle>
              <CardDescription className="text-xs">
                Create a custom license key with specific naming and settings.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 pt-1">
          <form onSubmit={handleSubmit} className="space-y-2">
            
            {/* Top Row: Target Type AND Product/Agent Select */}
            <div className="grid grid-cols-2 gap-3 items-end">
              {/* Column 1: Target Type (if visible) */}
              {showTargetTypeToggle ? (
                <div className="space-y-1">
                  <Label className="text-xs">Target Type</Label>
                  <ToggleGroup
                    type="single"
                    value={formData.targetType}
                    onValueChange={(value) => value && updateField('targetType', value as 'product' | 'agent')}
                    className="flex w-full gap-1"
                  >
                    <ToggleGroupItem 
                      value="product" 
                      className="flex-1 flex items-center justify-center gap-1 h-8 text-xs font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted transition-colors"
                    >
                      <Database className="size-3" />
                      Product
                    </ToggleGroupItem>
                    <ToggleGroupItem 
                      value="agent" 
                      className="flex-1 flex items-center justify-center gap-1 h-8 text-xs font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted transition-colors"
                    >
                      <Container className="size-3" />
                      Agent
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              ) : (
                <div className="hidden" />
              )}

              {/* Column 2: The Select Input */}
              <div className={!showTargetTypeToggle ? "col-span-2 space-y-1" : "space-y-1"}>
                
                {/* Product Select Logic */}
                {canViewProducts && (formData.targetType === 'product' || !canViewAgents) && (
                  <>
                    <Label className="text-xs">Product</Label>
                    {getProductLibraryProducts().length === 0 ? (
                      <div className="h-8 px-2 flex items-center border border-dashed border-muted-foreground/25 rounded-md bg-muted/20 text-[10px] text-muted-foreground leading-tight">
                        {products.length === 0 
                          ? "No products available." 
                          : "Only multi-app products available. Use Agent type."}
                      </div>
                    ) : (
                      <div className="flex gap-1 items-center">
                        <Select
                          value={formData.productId}
                          onValueChange={(value) => updateField('productId', value)}
                          disabled={loading}
                        >
                          <SelectTrigger className="flex-1 text-xs h-8">
                            <SelectValue placeholder="Select Product" />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            {getProductLibraryProducts().map((product) => (
                              <SelectItem key={product.id} value={product.id.toString()} className="text-xs">
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => updateField('productId', '')}
                          disabled={loading}
                          className="h-8 w-8 shrink-0"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* Agent Select Logic */}
                {((formData.targetType === 'agent' && canViewAgents) || (canViewAgents && !canViewProducts)) && (
                  <>
                    <Label className="text-xs">Agent</Label>
                    {agents.length === 0 ? (
                      <div className="h-8 px-2 flex items-center border border-dashed border-muted-foreground/25 rounded-md bg-muted/20 text-xs text-muted-foreground">
                        No agents available
                      </div>
                    ) : (
                      <div className="flex gap-1 items-center">
                        <Select
                          value={formData.agentId}
                          onValueChange={(value) => {
                            updateField('agentId', value);
                            updateField('selectedProducts', []);
                          }}
                          disabled={loading || agentsLoading}
                        >
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
                            updateField('agentId', '');
                            updateField('selectedProducts', []);
                          }}
                          disabled={loading}
                          className="h-8 w-8 shrink-0"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Key Name Row */}
            <div className="space-y-1 pt-1">
              <Label className="text-xs">Key Name</Label>
              <Input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Enter key name"
                disabled={loading}
                required
                className="h-8 text-xs"
              />
            </div>

            {/* Agent Sub-Selection (List of products) */}
            {formData.targetType === 'agent' && formData.agentId && (
              <div className="pt-1">
                 <div className="space-y-1">
                  <div className="flex items-center justify-between">
                     <Label className="text-xs">Assigned Products</Label>
                     {getAssignedProductsForAgent(parseInt(formData.agentId)).length > 0 && (
                        <div className="flex items-center space-x-1">
                          <Checkbox
                            id="select-all-custom-products"
                            className="h-3 w-3"
                            checked={formData.selectedProducts.length === getAssignedProductsForAgent(parseInt(formData.agentId)).length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const allProductIds = getAssignedProductsForAgent(parseInt(formData.agentId)).map(product => product.id);
                                updateField('selectedProducts', allProductIds);
                              } else {
                                updateField('selectedProducts', []);
                              }
                            }}
                          />
                          <Label htmlFor="select-all-custom-products" className="text-[10px] cursor-pointer text-muted-foreground">Select All</Label>
                        </div>
                     )}
                  </div>

                  {getAssignedProductsForAgent(parseInt(formData.agentId)).length === 0 ? (
                    <div className="p-2 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20 text-center text-xs text-muted-foreground">
                      Agent has no assigned products
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto border rounded-md p-1.5 bg-muted/10">
                      {getAssignedProductsForAgent(parseInt(formData.agentId)).map(product => (
                        <div key={product.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded transition-colors">
                          <Checkbox
                            id={`custom-product-${product.id}`}
                            className="h-3 w-3"
                            checked={formData.selectedProducts.includes(product.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateField('selectedProducts', [...formData.selectedProducts, product.id]);
                              } else {
                                updateField('selectedProducts', formData.selectedProducts.filter(id => id !== product.id));
                              }
                            }}
                          />
                          <Label htmlFor={`custom-product-${product.id}`} className="text-xs cursor-pointer w-full truncate" title={sanitizeString(product.name)}>
                            {sanitizeString(product.name)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Duration Section */}
            <div className="space-y-1 pt-1">
              <Label className="text-xs">Duration</Label>
              <div className="grid grid-cols-6 gap-1">
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
                    className="text-[10px] h-7 px-0"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Hours & Max Devices Row */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">Custom Hours</Label>
                <Input
                  type="number"
                  placeholder="e.g., 48"
                  value={formData.customHours}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateField('customHours', value);
                    if (value) updateField('duration', '');
                  }}
                  disabled={loading}
                  min="1"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Devices</Label>
                <Input
                  type="number"
                  value={formData.maxDevices}
                  onChange={(e) => updateField('maxDevices', parseInt(e.target.value) || 1)}
                  disabled={loading}
                  min="1"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading || !keyName.trim() || (formData.targetType === 'product' ? !formData.productId : !formData.agentId || formData.selectedProducts.length === 0)}
                className="w-full h-8 text-xs gap-2"
              >
                <Plus className="size-3" />
                {loading ? 'Creating...' : 'Create Custom Key'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </ConditionalRender>
  );
};