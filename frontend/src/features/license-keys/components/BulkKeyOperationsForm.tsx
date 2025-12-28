import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
  TargetTypeSelector,
  ProductSelector,
  AgentSelector,
  AdvancedFilters,
  FilteredOperations,
  QuickOperations,
  type FilterState,
} from './BulkOperations';

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

  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    activationStatus: 'all',
    deviceUsage: 'all',
    maxDevices: 'all',
    dateRange: 'all',
    customDateFrom: '',
    customDateTo: ''
  });

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

  return (
    <ConditionalRender permission="keys.generate" fallback={null}>
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Bulk Key Operations</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Perform actions on multiple keys at once based on filters.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {showTargetTypeToggle && (
              <TargetTypeSelector
                value={formData.targetType}
                onChange={(value) => updateField('targetType', value)}
              />
            )}

            {(formData.targetType === 'product' && canViewProducts) || (canViewProducts && !canViewAgents) ? (
              <ProductSelector
                products={getProductLibraryProducts()}
                value={formData.productId}
                onChange={(value) => updateField('productId', value)}
              />
            ) : ((formData.targetType === 'agent' && canViewAgents) || (canViewAgents && !canViewProducts)) ? (
              <AgentSelector
                agents={agents}
                agentId={formData.agentId}
                selectedProducts={formData.selectedProducts}
                availableProducts={formData.agentId ? getAssignedProductsForAgent(parseInt(formData.agentId)) : []}
                agentsLoading={agentsLoading}
                onAgentChange={(value) => {
                  updateField('agentId', value);
                  updateField('selectedProducts', []);
                }}
                onProductsChange={(productIds) => updateField('selectedProducts', productIds)}
              />
            ) : null}

            <AdvancedFilters
              filters={filters}
              onFiltersChange={setFilters}
              onGetCount={handleGetCount}
              keysCount={keysCount}
              isLoading={bulkActionLoading === 'count'}
              disabled={!isTargetSelected}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Actions will be applied to all keys matching the selected targets above.
          </p>

          <FilteredOperations
            keysCount={keysCount || 0}
            onDelete={handleBulkDelete}
            onReset={handleBulkReset}
            onExtend={() => handleBulkExtend(24)}
            isLoading={bulkActionLoading !== null}
          />

          <QuickOperations
            onPause={() => handleQuickOperation('pause')}
            onActivate={() => handleQuickOperation('activate')}
            onAddHours={() => handleQuickOperation('addHours')}
            onDelete={handleBulkDelete}
            isLoading={bulkActionLoading !== null}
            disabled={!isTargetSelected}
          />
        </CardFooter>
      </Card>
    </ConditionalRender>
  );
};

