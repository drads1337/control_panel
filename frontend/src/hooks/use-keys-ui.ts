import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  archiveLicenseKey,
  type LicenseKey,
  getLicenseKeyDetails,
  revealLicenseKey
} from '@/entities/key';
import { useKeyMutations } from '@/hooks/use-key-mutations';
import { keyKeys } from '@/entities/key';
import { usePermissions } from '@/hooks/use-permissions';
import { isMaskedKey } from '@/lib/key-masking';

interface UseKeysUIParams {
  keys: LicenseKey[];
  loadProducts: () => Promise<void>;
  invalidateQueries: () => void;
}

interface UseKeysUIReturn {

  showKey: Record<number, boolean>;
  fullKeys: Record<number, string>;
  selectedKeys: Set<number>;
  actionLoading: Set<number>;
  selectedKey: LicenseKey | null;
  detailsDialogOpen: boolean;
  editDialogOpen: boolean;
  extendDialogOpen: boolean;

  handleToggleKeyVisibility: (keyId: number) => void;
  handleSelectKey: (keyId: number, selected: boolean) => void;
  handleSelectAll: (selected: boolean) => void;
  handleKeyAction: (action: string, keyId: number) => Promise<void>;
  handleViewDetails: (key: LicenseKey) => void;
  handleKeyCreated: (createdKeyId?: number) => Promise<void>;
  handleDialogSuccess: () => Promise<void>;
  setDetailsDialogOpen: (open: boolean) => void;
  setEditDialogOpen: (open: boolean) => void;
  setExtendDialogOpen: (open: boolean) => void;
  setSelectedKey: (key: LicenseKey | null) => void;
}

export function useKeysUI({
  keys,
  loadProducts,
  invalidateQueries,
}: UseKeysUIParams): UseKeysUIReturn {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const keyMutations = useKeyMutations();

  const canDeleteKeys = hasPermission('keys.delete');
  const canEditKeys = hasPermission('keys.edit');
  const canResetPcBinding = hasPermission('keys.reset_pc_binding');
  const canPauseResume = hasPermission('keys.pause_resume');
  const canExtend = hasPermission('keys.extend');
  const canBlock = hasPermission('keys.block');
  const canGenerateKeys = hasPermission('keys.generate');

  const [showKey, setShowKey] = useState<Record<number, boolean>>({});
  const [fullKeys, setFullKeys] = useState<Record<number, string>>({});
  const [selectedKeys, setSelectedKeys] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState<Set<number>>(new Set());
  const [selectedKey, setSelectedKey] = useState<LicenseKey | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);

  const handleToggleKeyVisibility = useCallback(async (keyId: number) => {

    const isCurrentlyVisible = showKey[keyId];

    if (isCurrentlyVisible) {
      setShowKey((prev) => ({
        ...prev,
        [keyId]: false,
      }));
      return;
    }

    if (fullKeys[keyId]) {

      setShowKey((prev) => ({
        ...prev,
        [keyId]: true,
      }));
      return;
    }

    try {
      const revealResponse = await revealLicenseKey(keyId);

      if (revealResponse.key && !revealResponse.key_masked && !isMaskedKey(revealResponse.key)) {

        setFullKeys((prev) => ({
          ...prev,
          [keyId]: revealResponse.key,
        }));
        setShowKey((prev) => ({
          ...prev,
          [keyId]: true,
        }));
      } else {

        toast.error('You do not have permission to view full keys. Contact your administrator.');
      }
    } catch (error: unknown) {
      const { getErrorStatus } = await import('@/lib/error-utils')
      const status = getErrorStatus(error)
      if (status === 403) {
        toast.error('You do not have permission to view full keys. Contact your administrator.');
      } else {
        toast.error('Failed to get full key. Please try again.');
      }
    }
  }, [showKey, fullKeys]);

  const handleSelectKey = useCallback((keyId: number, selected: boolean) => {
    setSelectedKeys((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(keyId);
      } else {
        newSet.delete(keyId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        const allKeyIds = new Set(keys.map((key) => key.id));
        setSelectedKeys(allKeyIds);
      } else {
        setSelectedKeys(new Set());
      }
    },
    [keys]
  );

  const handleKeyAction = useCallback(
    async (action: string, keyId: number) => {

      switch (action) {
        case 'delete':
          if (!canDeleteKeys) {
            toast.error('You do not have permission to delete keys');
            return;
          }
          break;
        case 'reset':
          if (!canResetPcBinding) {
            toast.error('You do not have permission to reset PC binding');
            return;
          }
          break;
        case 'pause':
        case 'resume':
          if (!canPauseResume) {
            toast.error('You do not have permission to pause/resume keys');
            return;
          }
          break;
        case 'block':
        case 'unblock':
          if (!canBlock) {
            toast.error('You do not have permission to block/unblock keys');
            return;
          }
          break;
        case 'extend':
          if (!canExtend) {
            toast.error('You do not have permission to extend keys');
            return;
          }
          break;
        case 'edit':
          if (!canEditKeys) {
            toast.error('You do not have permission to edit keys');
            return;
          }
          break;
        case 'copy':

          break;
        case 'duplicate':
          if (!canGenerateKeys) {
            toast.error('You do not have permission to generate keys');
            return;
          }
          break;
      }

      if (action !== 'copy' && action !== 'edit' && action !== 'extend') {
        setActionLoading((prev) => new Set(prev).add(keyId));
      }

      try {
        switch (action) {
          case 'copy':
            const keyToCopy = keys.find((k) => k.id === keyId);
            if (keyToCopy) {
              try {

                let fullKey: string;
                try {

                  if (fullKeys[keyId] && !isMaskedKey(fullKeys[keyId])) {
                    fullKey = fullKeys[keyId];
                  } else {

                    const revealResponse = await revealLicenseKey(keyId);
                    fullKey = revealResponse.key;

                    if (isMaskedKey(fullKey) || revealResponse.key_masked) {
                      toast.error('You do not have permission to copy full keys. Contact your administrator.');
                      return;
                    }

                    setFullKeys((prev) => ({
                      ...prev,
                      [keyId]: fullKey,
                    }));
                  }
                } catch (error: unknown) {
                  const { getErrorStatus } = await import('@/lib/error-utils')
                  const status = getErrorStatus(error)
                  if (status === 403) {
                    toast.error('You do not have permission to copy full keys. Contact your administrator.');
                  } else {
                    toast.error('Failed to get full key. Please try again.');
                  }
                  return;
                }

                await navigator.clipboard.writeText(fullKey);
                toast.success('Key copied to clipboard');
              } catch (clipboardError) {

                let fullKey: string;
                try {
                  if (fullKeys[keyId] && !isMaskedKey(fullKeys[keyId])) {
                    fullKey = fullKeys[keyId];
                  } else {
                    const revealResponse = await revealLicenseKey(keyId);
                    fullKey = revealResponse.key;

                    if (isMaskedKey(fullKey) || revealResponse.key_masked) {
                      toast.error('You do not have permission to copy full keys. Contact your administrator.');
                      return;
                    }

                    setFullKeys((prev) => ({
                      ...prev,
                      [keyId]: fullKey,
                    }));
                  }
                } catch (error: unknown) {
                  const { getErrorStatus } = await import('@/lib/error-utils')
                  const status = getErrorStatus(error)
                  if (status === 403) {
                    toast.error('You do not have permission to copy full keys. Contact your administrator.');
                  } else {
                    toast.error('Failed to get full key. Please try again.');
                  }
                  return;
                }

                const textArea = document.createElement('textarea');
                textArea.value = fullKey;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                  document.execCommand('copy');
                  toast.success('Key copied to clipboard');
                } catch (fallbackError) {
                  toast.error('Failed to copy key to clipboard');
                } finally {
                  document.body.removeChild(textArea);
                }
              }
            } else {
              toast.error('Key not found');
            }
            return;
          case 'delete':
            await keyMutations.deleteKey(keyId);
            break;
          case 'reset':
            await keyMutations.resetKey(keyId);
            break;
          case 'pause':
            await keyMutations.pauseKey(keyId);
            break;
          case 'resume':
            await keyMutations.resumeKey(keyId);
            break;
          case 'block':
            await keyMutations.blockKey(keyId);
            break;
          case 'unblock':
            await keyMutations.unblockKey(keyId);
            break;
          case 'archive':
            await archiveLicenseKey(keyId);
            toast.success('Key archived successfully');
            queryClient.invalidateQueries({ queryKey: keyKeys.lists() });
            break;
          case 'duplicate':
            await keyMutations.duplicateKey(keyId);
            break;
          case 'edit':
            const keyToEdit = keys.find((k) => k.id === keyId);
            if (keyToEdit) {
              setSelectedKey(keyToEdit);
              setEditDialogOpen(true);
            }
            break;
          case 'extend':
            const keyToExtend = keys.find((k) => k.id === keyId);
            if (keyToExtend) {
              setSelectedKey(keyToExtend);
              setExtendDialogOpen(true);
            }
            break;
          default:

        }
      } catch (error) {

      } finally {

        if (action !== 'copy' && action !== 'edit' && action !== 'extend') {
          setActionLoading((prev) => {
            const newSet = new Set(prev);
            newSet.delete(keyId);
            return newSet;
          });
        }
      }
    },
    [
      keys,
      fullKeys,
      canDeleteKeys,
      canResetPcBinding,
      canPauseResume,
      canBlock,
      canExtend,
      canEditKeys,
      canGenerateKeys,
      keyMutations,
      queryClient,
    ]
  );

  const handleViewDetails = useCallback((key: LicenseKey) => {
    setSelectedKey(key);
    setDetailsDialogOpen(true);
  }, []);

  const handleKeyCreated = useCallback(async (createdKeyId?: number) => {

    invalidateQueries();
  }, [invalidateQueries]);

  const handleDialogSuccess = useCallback(async () => {
    invalidateQueries();
    await loadProducts();
  }, [invalidateQueries, loadProducts]);

  return {

    showKey,
    fullKeys,
    selectedKeys,
    actionLoading,
    selectedKey,
    detailsDialogOpen,
    editDialogOpen,
    extendDialogOpen,

    handleToggleKeyVisibility,
    handleSelectKey,
    handleSelectAll,
    handleKeyAction,
    handleViewDetails,
    handleKeyCreated,
    handleDialogSuccess,
    setDetailsDialogOpen,
    setEditDialogOpen,
    setExtendDialogOpen,
    setSelectedKey,
  };
}
