import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

interface SecurityPermissions {
  // IP permissions
  canViewIPs: boolean;
  canBlockIPs: boolean;
  canUnblockIPs: boolean;
  
  // HWID permissions
  canViewHWIDs: boolean;
  canBlockHWIDs: boolean;
  canUnblockHWIDs: boolean;
  
  // General security permissions
  canManageRules: boolean;
  canViewFingerprints: boolean;
  canViewLogs: boolean;
  
  // Computed permissions
  canViewSecurity: boolean; // Has any security view permission
}

const SecurityPermissionsContext = createContext<SecurityPermissions | undefined>(undefined);

interface SecurityPermissionsProviderProps {
  children: ReactNode;
}

/**
 * SecurityPermissionsProvider
 * 
 * Provides security-related permissions to child components.
 * This eliminates the need to pass permissions through props (prop drilling)
 * and centralizes permission checks for the security module.
 * 
 * Usage:
 * ```tsx
 * <SecurityPermissionsProvider>
 *   <SecurityPage />
 * </SecurityPermissionsProvider>
 * ```
 * 
 * In components:
 * ```tsx
 * const { canViewIPs, canBlockIPs } = useSecurityPermissions();
 * ```
 */
export function SecurityPermissionsProvider({ children }: SecurityPermissionsProviderProps) {
  const { hasPermission } = usePermissions();

  const permissions = useMemo<SecurityPermissions>(() => {
    // IP permissions
    const canViewIPs = hasPermission('security.view_ips');
    const canBlockIPs = hasPermission('security.block_ips');
    const canUnblockIPs = hasPermission('security.unblock_ips');
    
    // HWID permissions
    const canViewHWIDs = hasPermission('security.view_hwids');
    const canBlockHWIDs = hasPermission('security.block_hwids');
    const canUnblockHWIDs = hasPermission('security.unblock_hwids');
    
    // General security permissions
    const canManageRules = hasPermission('security.manage_rules');
    const canViewFingerprints = hasPermission('security.view_fingerprints');
    const canViewLogs = hasPermission('security.view_logs');
    
    // Computed: has any security view permission
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

/**
 * Hook to access security permissions
 * 
 * @throws Error if used outside SecurityPermissionsProvider
 * 
 * @example
 * ```tsx
 * const { canViewIPs, canBlockIPs } = useSecurityPermissions();
 * ```
 */
export function useSecurityPermissions(): SecurityPermissions {
  const context = useContext(SecurityPermissionsContext);
  
  if (context === undefined) {
    throw new Error(
      'useSecurityPermissions must be used within a SecurityPermissionsProvider'
    );
  }
  
  return context;
}

