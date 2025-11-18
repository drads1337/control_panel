import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useReferrals } from '@/hooks/use-referrals';
import { useRBACRoles } from '@/hooks/use-rbac';
import { getGames } from '@/entities/game/api/game';
import type { Game } from '@/entities/game';
import type { Role } from '@/hooks/use-rbac';

interface ReferralCodeForm {
  code: string;
  expires_days: number;
  work_duration_days: number;
  selected_games: number[];
  selected_rbac_role: number | null;
  token_balance: number;
}

interface UseReferralsTabReturn {

  referralCodeForm: ReferralCodeForm;
  isCreateReferralDialogOpen: boolean;

  referralCodes: any[];
  roles: Role[];
  availableGames: Game[];
  isLoading: boolean;
  referralCodesError: Error | null;
  rbacLoading: boolean;
  rbacError: Error | null;
  gamesLoading: boolean;
  gamesError: Error | null;
  isCreating: boolean;

  setReferralCodeForm: (form: ReferralCodeForm | ((prev: ReferralCodeForm) => ReferralCodeForm)) => void;
  setIsCreateReferralDialogOpen: (open: boolean) => void;
  handleCreateReferralCode: () => Promise<void>;
  generateReferralCode: () => void;
  refetchReferralCodes: () => void;
}

export function useReferralsTab(): UseReferralsTabReturn {
  const [referralCodeForm, setReferralCodeForm] = useState<ReferralCodeForm>({
    code: '',
    expires_days: 7,
    work_duration_days: 7,
    selected_games: [],
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
    refetch: refetchReferralCodes 
  } = useReferrals();

  const { 
    data: roles = [], 
    isLoading: rbacLoading, 
    error: rbacError 
  } = useRBACRoles();

  const { 
    data: gamesData, 
    isLoading: gamesLoading, 
    error: gamesError 
  } = useQuery({
    queryKey: ['games', 'for-referrals'],
    queryFn: async () => {
      const response = await getGames('all');
      return response.games || [];
    },
    enabled: isCreateReferralDialogOpen,
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

  const availableGames = gamesData || [];

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
        game_ids: referralCodeForm.selected_games || [],
        token_balance: referralCodeForm.token_balance || 0
      });

      setReferralCodeForm({
        code: '',
        expires_days: 7,
        work_duration_days: 7,
        selected_games: [],
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

  return {

    referralCodeForm,
    isCreateReferralDialogOpen,

    referralCodes,
    roles,
    availableGames,
    isLoading: referralCodesLoading,
    referralCodesError: referralCodesError instanceof Error ? referralCodesError : null,
    rbacLoading,
    rbacError: rbacError instanceof Error ? rbacError : null,
    gamesLoading,
    gamesError: gamesError instanceof Error ? gamesError : null,
    isCreating,

    setReferralCodeForm,
    setIsCreateReferralDialogOpen,
    handleCreateReferralCode,
    generateReferralCode,
    refetchReferralCodes,
  };
}
