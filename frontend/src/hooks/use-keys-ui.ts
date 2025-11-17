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
import { keyKeys } from '@/hooks/use-keys-query';
import { usePermissions } from '@/hooks/use-permissions';
import { isMaskedKey } from '@/lib/key-masking';

interface UseKeysUIParams {
  keys: LicenseKey[];
  loadGames: () => Promise<void>;
  invalidateQueries: () => void;
}

interface UseKeysUIReturn {
  // UI State
  showKey: Record<number, boolean>;
  fullKeys: Record<number, string>;
  selectedKeys: Set<number>;
  actionLoading: Set<number>;
  selectedKey: LicenseKey | null;
  detailsDialogOpen: boolean;
  editDialogOpen: boolean;
  extendDialogOpen: boolean;

  // UI Actions
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

/**
 * Hook for managing keys UI state (dialogs, selections, visibility)
 * Separated from data management for better reusability
 */
export function useKeysUI({
  keys,
  loadGames,
  invalidateQueries,
}: UseKeysUIParams): UseKeysUIReturn {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const keyMutations = useKeyMutations();

  // Permissions
  const canDeleteKeys = hasPermission('keys.delete');
  const canEditKeys = hasPermission('keys.edit');
  const canResetPcBinding = hasPermission('keys.reset_pc_binding');
  const canPauseResume = hasPermission('keys.pause_resume');
  const canExtend = hasPermission('keys.extend');
  const canBlock = hasPermission('keys.block');
  const canGenerateKeys = hasPermission('keys.generate');

  // UI State
  const [showKey, setShowKey] = useState<Record<number, boolean>>({});
  const [fullKeys, setFullKeys] = useState<Record<number, string>>({}); // Store full keys when revealed
  const [selectedKeys, setSelectedKeys] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState<Set<number>>(new Set());
  const [selectedKey, setSelectedKey] = useState<LicenseKey | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);

  // Handlers
  const handleToggleKeyVisibility = useCallback(async (keyId: number) => {
    // Check current visibility state
    const isCurrentlyVisible = showKey[keyId];
    
    // If hiding, just toggle visibility
    if (isCurrentlyVisible) {
      setShowKey((prev) => ({
        ...prev,
        [keyId]: false,
      }));
      return;
    }
    
    // If showing, check if we have full key cached
    if (fullKeys[keyId]) {
      // We have the full key, just show it
      setShowKey((prev) => ({
        ...prev,
        [keyId]: true,
      }));
      return;
    }
    
    // SECURITY: Use explicit /reveal endpoint to get full key
    // This endpoint requires keys.view permission and logs the request
    try {
      const revealResponse = await revealLicenseKey(keyId);
      
      if (revealResponse.key && !revealResponse.key_masked && !isMaskedKey(revealResponse.key)) {
        // Store full key and show it
        setFullKeys((prev) => ({
          ...prev,
          [keyId]: revealResponse.key,
        }));
        setShowKey((prev) => ({
          ...prev,
          [keyId]: true,
        }));
      } else {
        // Key is still masked - user doesn't have permission
        toast.error('You do not have permission to view full keys. Contact your administrator.');
      }
    } catch (error: any) {
      console.error('Failed to reveal key:', error);
      
      // Check if it's a permission error
      if (error.response?.status === 403) {
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
      // Check permissions before executing actions
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
          // No permission check needed for copying to clipboard
          break;
        case 'duplicate':
          if (!canGenerateKeys) {
            toast.error('You do not have permission to generate keys');
            return;
          }
          break;
      }

      // Add key to loading state (skip for copy action as it's instant)
      if (action !== 'copy' && action !== 'edit' && action !== 'extend') {
        setActionLoading((prev) => new Set(prev).add(keyId));
      }

      try {
        switch (action) {
          case 'copy':
            const keyToCopy = keys.find((k) => k.id === keyId);
            if (keyToCopy) {
              try {
                // SECURITY: Use /reveal endpoint to get full key for copying
                // This ensures we have permission and get the real key, not masked version
                let fullKey: string;
                try {
                  // First check if we have it cached
                  if (fullKeys[keyId] && !isMaskedKey(fullKeys[keyId])) {
                    fullKey = fullKeys[keyId];
                  } else {
                    // Use /reveal endpoint to get full key
                    const revealResponse = await revealLicenseKey(keyId);
                    fullKey = revealResponse.key;
                    
                    // Double-check: if still masked, user doesn't have permission
                    if (isMaskedKey(fullKey) || revealResponse.key_masked) {
                      toast.error('You do not have permission to copy full keys. Contact your administrator.');
                      return;
                    }
                    
                    // Cache the full key
                    setFullKeys((prev) => ({
                      ...prev,
                      [keyId]: fullKey,
                    }));
                  }
                } catch (error: any) {
                  console.error('Failed to reveal key for copying:', error);
                  if (error.response?.status === 403) {
                    toast.error('You do not have permission to copy full keys. Contact your administrator.');
                  } else {
                    toast.error('Failed to get full key. Please try again.');
                  }
                  return;
                }
                
                await navigator.clipboard.writeText(fullKey);
                toast.success('Key copied to clipboard');
              } catch (clipboardError) {
                // Fallback for browsers that don't support clipboard API
                // Still fetch full key first
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
                } catch (error: any) {
                  console.error('Failed to reveal key for copying:', error);
                  if (error.response?.status === 403) {
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
            return; // Early return for copy action
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
            console.warn('Unknown action:', action);
        }
      } catch (error) {
        // Error handling is done in mutations, but we still need to remove loading state
        console.error('Error performing key action:', error);
      } finally {
        // Remove key from loading state (skip for copy, edit, extend actions)
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
    console.log('🔑 handleKeyCreated called, invalidating queries...', { createdKeyId });
    invalidateQueries();
  }, [invalidateQueries]);

  const handleDialogSuccess = useCallback(async () => {
    invalidateQueries();
    await loadGames();
  }, [invalidateQueries, loadGames]);

  return {
    // UI State
    showKey,
    fullKeys, // Export fullKeys so components can use full keys when showing
    selectedKeys,
    actionLoading,
    selectedKey,
    detailsDialogOpen,
    editDialogOpen,
    extendDialogOpen,

    // UI Actions
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

