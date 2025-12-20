import { useState, useCallback } from 'react';

export interface KeyFormData {
  targetType: 'product' | 'agent';
  productId: string;
  agentId: string;
  selectedProducts: number[];
  duration: string;
  customHours: string;
  maxDevices: number;
}

const initialFormData: KeyFormData = {
  targetType: 'product',
  productId: '',
  agentId: '',
  selectedProducts: [],
  duration: '1mo',
  customHours: '',
  maxDevices: 1,
};

export function useKeyForm({
  products,
  agents,
  initialTargetType = 'product',
}: {
  products: Array<{ id: number; name: string; is_multi_app: boolean }>;
  agents: Array<{ id: number; name: string; assigned_products: number[] }>;
  initialTargetType?: 'product' | 'agent';
}) {
  const [formData, setFormData] = useState<KeyFormData>({
    ...initialFormData,
    targetType: initialTargetType,
  });

  const updateField = useCallback(<K extends keyof KeyFormData>(
    field: K,
    value: KeyFormData[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const reset = useCallback(() => {
    setFormData({
      ...initialFormData,
      targetType: initialTargetType,
    });
  }, [initialTargetType]);

  const getProductLibraryProducts = useCallback(() => {
    return products.filter((product) => !product.is_multi_app);
  }, [products]);

  const getAssignedProductsForAgent = useCallback(
    (agentId: number) => {
      const agent = agents.find((l) => l.id === agentId);
      if (!agent) return [];
      return products.filter((product) => agent.assigned_products.includes(product.id));
    },
    [agents, products]
  );

  return {
    formData,
    updateField,
    reset,
    getProductLibraryProducts,
    getAssignedProductsForAgent,
  };
}
