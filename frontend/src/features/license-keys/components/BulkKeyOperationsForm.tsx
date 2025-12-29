import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Database, Container, X, Filter, BarChart2, CalendarIcon, Trash2, RefreshCw, Clock, PauseCircle, Play } from 'lucide-react';
import { useKeyForm } from '../hooks/use-key-form';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { 
  bulkDeleteKeysByFilters, 
  bulkResetKeysByFilters, 
  bulkExtendKeysByFilters,
  getKeysCountByFilters,
  bulkPauseKeys,
  bulkActivateKeys,
  bulkAddHoursToKeys,
  bulkPauseAgentKeys,
  bulkActivateAgentKeys,
  bulkAddHoursToAgentKeys
} from '@/entities/key/api/bulk';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/api/enhanced-client';
import {
  KEY_STATUS_OPTIONS,
  ACTIVATION_STATUS_OPTIONS,
  DEVICE_USAGE_OPTIONS,
  MAX_DEVICES_OPTIONS,
  DATE_RANGE_OPTIONS,
} from '@/shared/constants/filters';
import { sanitizeString } from '@/lib/sanitization';
import { cn } from '@/lib/utils';

export interface FilterState {
  status: string;
  activationStatus: string;
  deviceUsage: string;
  maxDevices: string;
  dateRange: string;
  customDateFrom: string;
  customDateTo: string;
}

interface BulkKeyOperationsFormProps {
  products: Array<{ id: number; name: string; is_multi_app: boolean }>;
  agents: Array<{ id: number; name: string; assigned_products: number[] }>;
  agentsLoading: boolean;
  onOperationComplete: () => void;
  canViewProducts: boolean;
  canViewAgents: boolean;
}

export const BulkKeyOperationsForm: React.FC<BulkKeyOperationsFormProps> = ({
  products,
  agents,
  agentsLoading,
  onOperationComplete,
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

  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null);
  const [keysCount, setKeysCount] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    activationStatus: 'all',
    deviceUsage: 'all',
    maxDevices: 'all',
    dateRange: 'all',
    customDateFrom: '',
    customDateTo: ''
  });

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters({ ...filters, [key]: value });
  };

  const buildFilters = () => {
    const filterParams: any = {};

    if (formData.targetType === 'product' && formData.productId) {
      filterParams.product_id = parseInt(formData.productId);
    } else if (formData.targetType === 'agent' && formData.agentId && formData.selectedProducts.length > 0) {
      filterParams.agent_id = parseInt(formData.agentId);
      filterParams.product_ids = formData.selectedProducts;
    }

    if (filters.status !== 'all') {
      filterParams.status = filters.status;
    }
    if (filters.activationStatus !== 'all') {
      filterParams.activation_status = filters.activationStatus;
    }
    if (filters.deviceUsage !== 'all') {
      filterParams.device_usage = filters.deviceUsage;
    }
    if (filters.maxDevices !== 'all') {
      filterParams.max_devices = filters.maxDevices;
    }
    if (filters.dateRange === 'custom') {
      if (filters.customDateFrom) filterParams.date_from = filters.customDateFrom;
      if (filters.customDateTo) filterParams.date_to = filters.customDateTo;
    } else if (filters.dateRange !== 'all') {
        // Логика диапазона дат, если она есть в API
    }

    return filterParams;
  };

  const handleGetCount = async () => {
    setBulkActionLoading('count');
    try {
      const filterParams = buildFilters();
      const result = await getKeysCountByFilters(filterParams);
      setKeysCount(result.count);
      toast.success(`Found ${result.count} keys matching the criteria`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!keysCount || keysCount === 0) {
      toast.error('Please get the count first');
      return;
    }

    setBulkActionLoading('delete');
    try {
      const filterParams = buildFilters();
      const result = await bulkDeleteKeysByFilters(filterParams);
      toast.success(result.message || `Deleted ${result.deleted_count} keys`);
      setKeysCount(null);
      onOperationComplete();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkReset = async () => {
    if (!keysCount || keysCount === 0) {
      toast.error('Please get the count first');
      return;
    }

    setBulkActionLoading('reset');
    try {
      const filterParams = buildFilters();
      const result = await bulkResetKeysByFilters(filterParams);
      toast.success(result.message || `Reset ${result.reset_count} keys`);
      setKeysCount(null);
      onOperationComplete();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkExtend = async (hours: number = 24) => {
    if (!keysCount || keysCount === 0) {
      toast.error('Please get the count first');
      return;
    }

    setBulkActionLoading('extend');
    try {
      const filterParams = buildFilters();
      const result = await bulkExtendKeysByFilters(hours, filterParams);
      toast.success(result.message || `Extended ${result.extended_count} keys`);
      setKeysCount(null);
      onOperationComplete();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleQuickOperation = async (action: 'pause' | 'activate' | 'addHours') => {
    if (formData.targetType === 'product' && !formData.productId) {
      toast.error('Please select a product');
      return;
    }
    if (formData.targetType === 'agent' && (!formData.agentId || formData.selectedProducts.length === 0)) {
      toast.error('Please select an agent and products');
      return;
    }

    setBulkActionLoading(action);
    try {
      if (formData.targetType === 'product' && formData.productId) {
        switch (action) {
          case 'pause':
            await bulkPauseKeys(parseInt(formData.productId));
            break;
          case 'activate':
            await bulkActivateKeys(parseInt(formData.productId));
            break;
          case 'addHours':
            await bulkAddHoursToKeys(parseInt(formData.productId), 24);
            break;
        }
        toast.success(`Bulk ${action} operation completed`);
        onOperationComplete();
      } else {
        if (formData.agentId && formData.selectedProducts && formData.selectedProducts.length > 0) {
          switch (action) {
            case 'pause':
              await bulkPauseAgentKeys(parseInt(formData.agentId), formData.selectedProducts);
              break;
            case 'activate':
              await bulkActivateAgentKeys(parseInt(formData.agentId), formData.selectedProducts);
              break;
            case 'addHours':
              await bulkAddHoursToAgentKeys(parseInt(formData.agentId), formData.selectedProducts, 24);
              break;
          }
          toast.success(`Bulk ${action} operation completed for ${formData.selectedProducts.length} products`);
          onOperationComplete();
        }
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBulkActionLoading(null);
    }
  };

  const isTargetSelected = (formData.targetType === 'product' && formData.productId) || 
                          (formData.targetType === 'agent' && formData.agentId && formData.selectedProducts.length > 0);

  const productLibraryProducts = getProductLibraryProducts();
  const assignedProducts = formData.agentId ? getAssignedProductsForAgent(parseInt(formData.agentId)) : [];

  return (
    <ConditionalRender permission="keys.generate" fallback={null}>
      <Card className="p-3 border rounded-lg bg-background shadow-sm">
        <CardHeader className="p-0 pb-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">Bulk Key Operations</CardTitle>
              <CardDescription className="text-xs">
                Perform actions on multiple keys at once based on filters.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          <div className="space-y-2">
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
                    className="flex w-full gap-1 p-0.5 bg-muted/50 rounded-md"
                  >
                    <ToggleGroupItem 
                      value="product" 
                      className="flex-1 flex items-center justify-center gap-1 h-7 text-xs font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted/50 transition-colors"
                    >
                      <Database className="size-3" />
                      Product
                    </ToggleGroupItem>
                    <ToggleGroupItem 
                      value="agent" 
                      className="flex-1 flex items-center justify-center gap-1 h-7 text-xs font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted/50 transition-colors"
                    >
                      <Container className="size-3" />
                      Agent
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              ) : (
                <div className="hidden" />
              )}

              {/* Column 2: The Select Input (changes based on Type) */}
              <div className={!showTargetTypeToggle ? "col-span-2 space-y-1" : "space-y-1"}>
                {/* Product Select Logic */}
                {canViewProducts && (formData.targetType === 'product' || !canViewAgents) && (
                  <>
                    <Label className="text-xs">Product</Label>
                    {productLibraryProducts.length === 0 ? (
                      <div className="h-8 px-2 flex items-center border border-dashed border-muted-foreground/25 rounded-md bg-muted/20 text-xs text-muted-foreground">
                        No products available
                      </div>
                    ) : (
                      <div className="flex gap-1 items-center">
                        <Select
                          value={formData.productId}
                          onValueChange={(value) => updateField('productId', value)}
                          disabled={bulkActionLoading !== null}
                        >
                          <SelectTrigger className="flex-1 text-xs h-8 bg-muted/30 border-muted-foreground/20 focus-visible:bg-background">
                            <SelectValue placeholder="Select Product" />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            {productLibraryProducts.map((product) => (
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
                          disabled={bulkActionLoading !== null}
                          className="h-8 w-8 shrink-0"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* Agent Select Logic */}
                {canViewAgents && (formData.targetType === 'agent' || !canViewProducts) && (
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
                          disabled={bulkActionLoading !== null || agentsLoading}
                        >
                          <SelectTrigger className="flex-1 text-xs h-8 bg-muted/30 border-muted-foreground/20 focus-visible:bg-background">
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
                          disabled={bulkActionLoading !== null}
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

            {/* Agent Sub-Selection (List of products) - Full Width */}
            {canViewAgents && formData.targetType === 'agent' && formData.agentId && (
              <div className="pt-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Assigned Products</Label>
                    {assignedProducts.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Checkbox
                          id="select-all-bulk-products"
                          className="h-3 w-3"
                          checked={formData.selectedProducts.length === assignedProducts.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const allProductIds = assignedProducts.map(product => product.id);
                              updateField('selectedProducts', allProductIds);
                            } else {
                              updateField('selectedProducts', []);
                            }
                          }}
                        />
                        <Label htmlFor="select-all-bulk-products" className="text-[10px] cursor-pointer text-muted-foreground">Select All</Label>
                      </div>
                    )}
                  </div>
                  
                  {assignedProducts.length === 0 ? (
                    <div className="p-2 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20 text-center text-xs text-muted-foreground">
                      Agent has no assigned products
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto border border-muted-foreground/10 rounded-md p-1.5 bg-muted/10">
                      {assignedProducts.map(product => (
                        <div key={product.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded transition-colors">
                          <Checkbox
                            id={`bulk-product-${product.id}`}
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
                          <Label htmlFor={`bulk-product-${product.id}`} className="text-xs cursor-pointer w-full truncate" title={sanitizeString(product.name)}>
                            {sanitizeString(product.name)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Advanced Filters Section */}
            <div className="pt-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-muted/30 p-1.5 rounded-md border">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs ml-0.5">Operation Filters</Label>
                    {keysCount !== null && !showFilters && (
                      <Badge variant="secondary" className="text-[10px]">
                        {keysCount} keys found
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant={showFilters ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="h-7 text-xs"
                  >
                    <Filter className="size-3 mr-1" />
                    {showFilters ? 'Hide' : 'Show'}
                  </Button>
                </div>

                {showFilters && (
                  <div className="space-y-2 p-2 border rounded-md bg-card shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
                    {/* Main Filters Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Key Status</Label>
                        <Select
                          value={filters.status}
                          onValueChange={(value) => updateFilter('status', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            {KEY_STATUS_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Activation Status</Label>
                        <Select
                          value={filters.activationStatus}
                          onValueChange={(value) => updateFilter('activationStatus', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background">
                            <SelectValue placeholder="Select activation status" />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            {ACTIVATION_STATUS_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Device Usage</Label>
                        <Select
                          value={filters.deviceUsage}
                          onValueChange={(value) => updateFilter('deviceUsage', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background">
                            <SelectValue placeholder="Select usage" />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            {DEVICE_USAGE_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Max Devices</Label>
                        <Select
                          value={filters.maxDevices}
                          onValueChange={(value) => updateFilter('maxDevices', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background">
                            <SelectValue placeholder="Select device limit" />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            {MAX_DEVICES_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                        <Label className="text-[10px] text-muted-foreground">Creation Period</Label>
                        <Select
                          value={filters.dateRange}
                          onValueChange={(value) => updateFilter('dateRange', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            {DATE_RANGE_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Custom Date Range */}
                    {filters.dateRange === 'custom' && (
                      <div className="bg-muted/30 p-2 rounded-md border border-dashed">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <CalendarIcon className="size-3 text-muted-foreground" />
                          <span className="text-[10px] font-medium">Custom Range</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">From</Label>
                            <Input
                              type="date"
                              value={filters.customDateFrom}
                              onChange={(e) => updateFilter('customDateFrom', e.target.value)}
                              className="h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">To</Label>
                            <Input
                              type="date"
                              value={filters.customDateTo}
                              onChange={(e) => updateFilter('customDateTo', e.target.value)}
                              className="h-8 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Footer Actions */}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2">
                      {keysCount !== null ? (
                        <div className="flex items-center justify-center sm:justify-start gap-1.5 p-1.5 bg-primary/10 border border-primary/20 rounded text-xs w-full sm:w-auto">
                          <span className="text-muted-foreground">Result:</span>
                          <span className="font-bold text-primary">{keysCount}</span>
                          <span className="text-muted-foreground">keys</span>
                        </div>
                      ) : (
                        <div className="hidden sm:block" />
                      )}

                      <Button
                        variant="default"
                        onClick={handleGetCount}
                        disabled={bulkActionLoading === 'count' || !isTargetSelected}
                        className="w-full sm:w-auto min-w-[120px] h-8 text-xs"
                      >
                        <BarChart2 className={cn("size-3 mr-1.5", bulkActionLoading === 'count' && "animate-spin")} />
                        {bulkActionLoading === 'count' ? 'Calculating...' : 'Count Keys'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 p-0 pt-1">
          <p className="text-xs text-muted-foreground">
            Actions will be applied to all keys matching the selected targets above.
          </p>

          {/* Filtered Operations */}
          {keysCount !== null && keysCount > 0 && (
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-green-700">
                  Filtered Operations ({keysCount} keys)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading !== null}
                  size="sm"
                  className="h-8 text-xs"
                >
                  <Trash2 className="size-3 mr-1.5" />
                  {bulkActionLoading === 'delete' ? 'Processing...' : `Delete ${keysCount}`}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBulkReset}
                  disabled={bulkActionLoading !== null}
                  size="sm"
                  className="h-8 text-xs"
                >
                  <RefreshCw className="size-3 mr-1.5" />
                  {bulkActionLoading === 'reset' ? 'Processing...' : `Reset ${keysCount}`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleBulkExtend(24)}
                  disabled={bulkActionLoading !== null}
                  size="sm"
                  className="h-8 text-xs"
                >
                  <Clock className="size-3 mr-1.5" />
                  {bulkActionLoading === 'extend' ? 'Processing...' : `Extend ${keysCount}`}
                </Button>
              </div>
            </div>
          )}

          {/* Quick Operations */}
          <div className="w-full space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-blue-700">Quick Operations (all keys)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => handleQuickOperation('pause')}
                disabled={bulkActionLoading !== null || !isTargetSelected}
                size="sm"
                className="h-8 text-xs"
              >
                <PauseCircle className="size-3 mr-1.5" />
                {bulkActionLoading === 'pause' ? 'Processing...' : 'Pause'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleQuickOperation('activate')}
                disabled={bulkActionLoading !== null || !isTargetSelected}
                size="sm"
                className="h-8 text-xs"
              >
                <Play className="size-3 mr-1.5" />
                {bulkActionLoading === 'activate' ? 'Processing...' : 'Activate'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleQuickOperation('addHours')}
                disabled={bulkActionLoading !== null || !isTargetSelected}
                size="sm"
                className="h-8 text-xs"
              >
                <Clock className="size-3 mr-1.5" />
                {bulkActionLoading === 'addHours' ? 'Processing...' : 'Add Hours'}
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkActionLoading !== null || !isTargetSelected}
                size="sm"
                className="h-8 text-xs"
              >
                <Trash2 className="size-3 mr-1.5" />
                {bulkActionLoading === 'delete' ? 'Processing...' : 'Delete All'}
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </ConditionalRender>
  );
};

