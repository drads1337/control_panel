import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useReferrals } from '@/features/user-administration/hooks/use-referrals';
import { useRBACRoles } from '@/features/user-administration/hooks/use-rbac';
import { getProducts } from '@/entities/product/api/product';
import type { Product } from '@/entities/product';
import type { Role } from '@/features/user-administration/hooks/use-rbac';

interface ReferralCodeForm {
  code: string;
  expires_days: number;
  work_duration_days: number;
  selected_products: number[];
  selected_rbac_role: number | null;
  token_balance: number;
}

interface UseReferralsTabReturn {

  referralCodeForm: ReferralCodeForm;
  isCreateReferralDialogOpen: boolean;

  referralCodes: any[];
  roles: Role[];
  availableProducts: Product[];
  isLoading: boolean;
  referralCodesError: Error | null;
  rbacLoading: boolean;
  rbacError: Error | null;
  productsLoading: boolean;
  productsError: Error | null;
  isCreating: boolean;
  isDeleting: boolean;

  setReferralCodeForm: (form: ReferralCodeForm | ((prev: ReferralCodeForm) => ReferralCodeForm)) => void;
  setIsCreateReferralDialogOpen: (open: boolean) => void;
  handleCreateReferralCode: () => Promise<void>;
  generateReferralCode: () => void;
  deleteReferralCode: (codeId: number) => Promise<void>;
  refetchReferralCodes: () => void;
}

export function useReferralsTab(): UseReferralsTabReturn {
  const [referralCodeForm, setReferralCodeForm] = useState<ReferralCodeForm>({
    code: '',
    expires_days: 7,
    work_duration_days: 7,
    selected_products: [],
    selected_rbac_role: null,
    token_balance: 0
  });
  const [isCreateReferralDialogOpen, setIsCreateReferralDialogOpen] = useState(false);

  const { 
    codes: referralCodes, 
    isLoading: referralCodesLoading, 
    error: referralCodesError, 
    createCode, 
    isCreating,
    deleteCode,
    isDeleting,
    refetch: refetchReferralCodes 
  } = useReferrals();

  const { 
    data: roles = [], 
    isLoading: rbacLoading, 
    error: rbacError 
  } = useRBACRoles();

  const { 
    data: productsData, 
    isLoading: productsLoading, 
    error: productsError 
  } = useQuery({
    queryKey: ['products', 'for-referrals'],
    queryFn: async () => {
      const response = await getProducts('all');
      return response.products || [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403 || error?.response?.status === 429) {
        return false;
      }
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
  });

  const availableProducts = productsData || [];

  const handleCreateReferralCode = useCallback(async () => {
    try {
      if (!referralCodeForm.code) {
        toast.error('Referral code is required');
        return;
      }

      if (!referralCodeForm.selected_rbac_role) {
        toast.error('Please select a RBAC role');
        return;
      }

      await createCode({
        code: referralCodeForm.code,
        expires_days: referralCodeForm.expires_days || 7,
        work_duration_days: referralCodeForm.work_duration_days || 7,
        rbac_role_ids: referralCodeForm.selected_rbac_role ? [referralCodeForm.selected_rbac_role] : [],
        product_ids: referralCodeForm.selected_products || [],
        token_balance: referralCodeForm.token_balance || 0
      });

      setReferralCodeForm({
        code: '',
        expires_days: 7,
        work_duration_days: 7,
        selected_products: [],
        selected_rbac_role: null,
        token_balance: 0
      });
      setIsCreateReferralDialogOpen(false);
    } catch (error) {

    }
  }, [referralCodeForm, createCode]);

  const generateReferralCode = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setReferralCodeForm(prev => ({ ...prev, code: result }));
  }, []);

  const deleteReferralCode = useCallback(async (codeId: number) => {
    await deleteCode(codeId);
  }, [deleteCode]);

  return {

    referralCodeForm,
    isCreateReferralDialogOpen,

    referralCodes,
    roles,
    availableProducts,
    isLoading: referralCodesLoading,
    referralCodesError: referralCodesError instanceof Error ? referralCodesError : null,
    rbacLoading,
    rbacError: rbacError instanceof Error ? rbacError : null,
    productsLoading,
    productsError: productsError instanceof Error ? productsError : null,
    isCreating,
    isDeleting,

    setReferralCodeForm,
    setIsCreateReferralDialogOpen,
    handleCreateReferralCode,
    generateReferralCode,
    deleteReferralCode,
    refetchReferralCodes,
  };
}
