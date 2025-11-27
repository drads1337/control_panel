import React, { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthContext } from '@/contexts/auth-context';
import { enhancedApi } from '@/shared/api/enhanced-client';
import { toast } from 'sonner';
import { createLicenseKey, createCustomLicenseKey, bulkCreateLicenseKeys, createAgentKey, createCustomAgentKey, bulkCreateAgentKeys } from '@/entities/key';
import { getAgents } from '@/entities/agent';
import { SingleKeyForm } from './components/SingleKeyForm';
import { CustomKeyForm } from './components/CustomKeyForm';
import { BulkKeyForm } from './components/BulkKeyForm';
import { BulkKeyOperationsForm } from './components/BulkKeyOperationsForm';

interface LicenseKeyCreationGridProps {
  products: Array<{ id: number; name: string; is_multi_app: boolean }>;
  onKeyCreated: (createdKeyId?: number) => void;
}

const LicenseKeyCreationGrid: React.FC<LicenseKeyCreationGridProps> = ({ products, onKeyCreated }) => {
  const { hasPermission } = usePermissions();
  const { user } = useAuthContext();
  const canCreate = hasPermission('keys.create');
  const canGenerate = hasPermission('keys.generate');

  const [loading, setLoading] = useState({
    single: false,
    custom: false,
    bulk: false,
  });

  const [agents, setAgents] = useState<Array<{ id: number; name: string; assigned_products: number[] }>>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  const [userProductAccess, setUserProductAccess] = useState<number[]>([]);
  const [productAccessLoading, setProductAccessLoading] = useState(false);

  const loadUserProductAccess = async () => {
    if (!user?.id) return;

    const url = `/api/users/${user.id}/products`

    try {
      setProductAccessLoading(true);
      // Use universal endpoint - products instead of products
      const response = await enhancedApi.get(url);

      if (Array.isArray(response.data)) {
        const accessibleProducts = response.data
          .filter((product: any) => product.has_access === true)
          .map((product: any) => product.product_id || product.id);
        

        setUserProductAccess(accessibleProducts);
      }
    } catch (error: unknown) {
      // Silently handle errors - user may not have product access configured
      setUserProductAccess([]);
    } finally {
      setProductAccessLoading(false);
    }
  };

  const productLibraryProducts = products.filter(product => !product.is_multi_app);
  const canViewProducts = hasPermission('products.view') || productLibraryProducts.length > 0;

  const canViewAgents = hasPermission('agents.view');

  useEffect(() => {
    loadAgents();
    loadUserProductAccess();
  }, [user?.id, products.length]);

  const loadAgents = async () => {
    try {
      setAgentsLoading(true);
      const response = await getAgents();
      if (response.success) {
        setAgents(response.agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          assigned_products: agent.assigned_products || []
        })));
      }
    } catch (error) {

      toast.error('Error loading agents');
    } finally {
      setAgentsLoading(false);
    }
  };

  const handleSingleKeySubmit = async (data: {
    targetType: 'product' | 'agent';
    productId?: number;
    agentId?: number;
    selectedProducts?: number[];
    duration_hours: number;
    max_devices: number;
  }) => {
    if (!canCreate && !canGenerate) {
      toast.error('You do not have permission to create keys');
      return;
    }

    setLoading(prev => ({ ...prev, single: true }));

    try {
      if (data.targetType === 'agent') {
        if (!data.agentId || !data.selectedProducts || data.selectedProducts.length === 0) {
          throw new Error('Please select a agent and at least one product');
        }

        const result = await createAgentKey({
          agent_id: data.agentId,
          product_ids: data.selectedProducts,
          duration_hours: data.duration_hours,
          max_devices: data.max_devices
        });

        toast.success(result.message || `${data.selectedProducts.length} license keys created successfully!`);
        onKeyCreated();
      } else {
        if (!data.productId) {
          throw new Error('Please select a product');
        }

        const result = await createLicenseKey({
          product_id: data.productId,
          duration_hours: data.duration_hours,
          max_devices: data.max_devices
        });
        toast.success(result.message || 'License key created successfully!');
        onKeyCreated(result.key?.id);
      }
    } catch (error) {

      toast.error(error instanceof Error ? error.message : 'Error creating license key');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, single: false }));
    }
  };

  const handleCustomKeySubmit = async (data: {
    targetType: 'product' | 'agent';
    productId?: number;
    agentId?: number;
    selectedProducts?: number[];
    keyName: string;
    duration_hours: number;
    max_devices: number;
  }) => {
    if (!canCreate && !canGenerate) {
      toast.error('You do not have permission to create keys');
      return;
    }

    setLoading(prev => ({ ...prev, custom: true }));

    try {
      if (data.targetType === 'agent') {
        if (!data.agentId || !data.selectedProducts || data.selectedProducts.length === 0) {
          throw new Error('Please select a agent and at least one product');
        }

        const result = await createCustomAgentKey({
          agent_id: data.agentId,
          product_ids: data.selectedProducts,
          duration_hours: data.duration_hours,
          max_devices: data.max_devices,
          custom_key: data.keyName || `CUSTOM-${Date.now()}`
        });

        toast.success(result.message || `${data.selectedProducts.length} custom license keys created successfully!`);
      } else {
        if (!data.productId) {
          throw new Error('Please select a product');
        }

        const result = await createCustomLicenseKey({
          product_id: data.productId,
          duration_hours: data.duration_hours,
          max_devices: data.max_devices,
          custom_key: data.keyName || `CUSTOM-${Date.now()}`
        });
        toast.success(result.message || 'Custom key created successfully!');
      }

      onKeyCreated();
    } catch (error) {

      toast.error(error instanceof Error ? error.message : 'Error creating custom key');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, custom: false }));
    }
  };

  const handleBulkKeySubmit = async (data: {
    targetType: 'product' | 'agent';
    productId?: number;
    agentId?: number;
    selectedProducts?: number[];
    quantity: number;
    duration_hours: number;
    max_devices: number;
  }) => {
    if (!canCreate && !canGenerate) {
      toast.error('You do not have permission to create keys');
      return;
    }

    setLoading(prev => ({ ...prev, bulk: true }));

    try {
      if (data.targetType === 'agent') {
        if (!data.agentId || !data.selectedProducts || data.selectedProducts.length === 0) {
          throw new Error('Please select a agent and at least one product');
        }

        const result = await bulkCreateAgentKeys({
          agent_id: data.agentId,
          product_ids: data.selectedProducts,
          count: data.quantity,
          duration_hours: data.duration_hours,
          max_devices: data.max_devices
        });

        toast.success(result.message || `${data.quantity * data.selectedProducts.length} keys created successfully!`);
        onKeyCreated();
      } else {
        if (!data.productId) {
          throw new Error('Please select a product');
        }

        const result = await bulkCreateLicenseKeys({
          product_id: data.productId,
          count: data.quantity,
          duration_hours: data.duration_hours,
          max_devices: data.max_devices
        });
        toast.success(result.message || `${data.quantity} keys created successfully!`);
        onKeyCreated();
      }
    } catch (error) {

      toast.error(error instanceof Error ? error.message : 'Error creating bulk keys');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, bulk: false }));
    }
  };

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">No Products Available</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                Create your first product to start generating license keys. You can create both regular products and multi-app products.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canCreate && !canGenerate) {
    return null;
  }

  return (
    <div className="space-y-6">
      {}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {}
        <SingleKeyForm
          products={products}
          agents={agents}
          agentsLoading={agentsLoading}
          onSubmit={handleSingleKeySubmit}
          loading={loading.single}
          canViewProducts={canViewProducts}
          canViewAgents={canViewAgents}
        />

        {}
        <CustomKeyForm
          products={products}
          agents={agents}
          agentsLoading={agentsLoading}
          onSubmit={handleCustomKeySubmit}
          loading={loading.custom}
          canViewProducts={canViewProducts}
          canViewAgents={canViewAgents}
        />

        {}
        <BulkKeyForm
          products={products}
          agents={agents}
          agentsLoading={agentsLoading}
          onSubmit={handleBulkKeySubmit}
          loading={loading.bulk}
          canViewProducts={canViewProducts}
          canViewAgents={canViewAgents}
        />

        {}
        <BulkKeyOperationsForm
          products={products}
          agents={agents}
          agentsLoading={agentsLoading}
          onOperationComplete={onKeyCreated}
          canViewProducts={canViewProducts}
          canViewAgents={canViewAgents}
        />
      </div>
    </div>
  );
};

export default LicenseKeyCreationGrid;
