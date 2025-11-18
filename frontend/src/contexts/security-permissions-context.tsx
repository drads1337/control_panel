import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

interface SecurityPermissions {

  canViewIPs: boolean;
  canBlockIPs: boolean;
  canUnblockIPs: boolean;

  canViewHWIDs: boolean;
  canBlockHWIDs: boolean;
  canUnblockHWIDs: boolean;

  canManageRules: boolean;
  canViewFingerprints: boolean;
  canViewLogs: boolean;

  canViewSecurity: boolean;
}

const SecurityPermissionsContext = createContext<SecurityPermissions | undefined>(undefined);

interface SecurityPermissionsProviderProps {
  children: ReactNode;
}

export function SecurityPermissionsProvider({ children }: SecurityPermissionsProviderProps) {
  const { hasPermission } = usePermissions();

  const permissions = useMemo<SecurityPermissions>(() => {

    const canViewIPs = hasPermission('security.view_ips');
    const canBlockIPs = hasPermission('security.block_ips');
    const canUnblockIPs = hasPermission('security.unblock_ips');

    const canViewHWIDs = hasPermission('security.view_hwids');
    const canBlockHWIDs = hasPermission('security.block_hwids');
    const canUnblockHWIDs = hasPermission('security.unblock_hwids');

    const canManageRules = hasPermission('security.manage_rules');
    const canViewFingerprints = hasPermission('security.view_fingerprints');
    const canViewLogs = hasPermission('security.view_logs');

    const canViewSecurity = canViewIPs || 
                           canViewHWIDs || 
                           canViewFingerprints ||
                           canViewLogs ||
                           canManageRules;

    return {
      canViewIPs,
      canBlockIPs,
      canUnblockIPs,
      canViewHWIDs,
      canBlockHWIDs,
      canUnblockHWIDs,
      canManageRules,
      canViewFingerprints,
      canViewLogs,
      canViewSecurity,
    };
  }, [hasPermission]);

  return (
    <SecurityPermissionsContext.Provider value={permissions}>
      {children}
    </SecurityPermissionsContext.Provider>
  );
}

export function useSecurityPermissions(): SecurityPermissions {
  const context = useContext(SecurityPermissionsContext);

  if (context === undefined) {
    throw new Error(
      'useSecurityPermissions must be used within a SecurityPermissionsProvider'
    );
  }

  return context;
}
