import React, { useState, useCallback } from 'react';
import { useAuthContext } from '../../contexts/auth-context';
import { SecurityPermissionsProvider, useSecurityPermissions } from '../../contexts/security-permissions-context';
import SecurityTabs from './security-tabs';
import { useSecurityActions } from './hooks/use-security-actions';
import { SecurityAccessDenied } from './security-access-denied';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

function SecurityPageContent() {
  const { isAuthenticated, user, isInitialized } = useAuthContext();
  const securityPermissions = useSecurityPermissions();

  const [activeTab, setActiveTab] = useState('blocked-ips');
  const [ipSearchTerm, setIPSearchTerm] = useState('');
  const [hwidSearchTerm, setHWIDSearchTerm] = useState('');

  const {
    stats,
    loading,
    blockedIPs,
    blockedHWIDs,
    handleUnblockIP,
    handleUnblockHWID,
    handleViewIPDetails,
    handleViewHWIDDetails,
    handleBlockIP,
    handleBlockHWID,
    handleRefreshIPs,
    handleRefreshHWIDs,
    handleRefreshRules,
  } = useSecurityActions();

  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Initializing...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <SecurityAccessDenied message="You need to be logged in to view the security panel." />;
  }

  if (!securityPermissions.canViewSecurity) {
    return <SecurityAccessDenied message="You don't have permission to access the security panel." />;
  }

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      handleRefreshIPs(),
      handleRefreshHWIDs(),
      handleRefreshRules()
    ]);
  }, [handleRefreshIPs, handleRefreshHWIDs, handleRefreshRules]);

  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 px-2 xs:px-3 sm:px-4 md:px-0">
      <div className="mb-3 xs:mb-4 sm:mb-5 md:mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">Security Management</h1>
            <p className="text-xs xs:text-sm sm:text-sm md:text-base text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
              Manage IP/HWID blocks and configure security rules
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <SecurityTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        blockedIPs={blockedIPs}
        blockedHWIDs={blockedHWIDs}
        loading={loading}
        ipSearchTerm={ipSearchTerm}
        setIPSearchTerm={setIPSearchTerm}
        hwidSearchTerm={hwidSearchTerm}
        setHWIDSearchTerm={setHWIDSearchTerm}
        onUnblockIP={handleUnblockIP}
        onUnblockHWID={handleUnblockHWID}
        onViewIPDetails={handleViewIPDetails}
        onViewHWIDDetails={handleViewHWIDDetails}
        onBlockIP={handleBlockIP}
        onBlockHWID={handleBlockHWID}
        onRefreshIPs={handleRefreshIPs}
        onRefreshHWIDs={handleRefreshHWIDs}
        onRefreshRules={handleRefreshRules}
      />
    </div>
  );
}

export default function SecurityPage() {
  return (
    <SecurityPermissionsProvider>
      <SecurityPageContent />
    </SecurityPermissionsProvider>
  );
}