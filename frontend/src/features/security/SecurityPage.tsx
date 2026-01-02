import React, { useState, useCallback } from 'react';
import { useAuthContext } from '@/app/providers/auth-provider';
import { SecurityPermissionsProvider, useSecurityPermissions } from '@/contexts/security-permissions-context';
import SecurityTabs from './components/SecurityTabs';
import { useSecurityActions } from './hooks/use-security-actions';
import { AccessDenied } from '@/shared/ui/components';
import { Button } from '@/components/ui/button';
import { RefreshCw, Shield } from 'lucide-react';

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

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      handleRefreshIPs(),
      handleRefreshHWIDs(),
      handleRefreshRules()
    ]);
  }, [handleRefreshIPs, handleRefreshHWIDs, handleRefreshRules]);

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
    return (
      <AccessDenied
        isAuthenticated={false}
        hasAccess={false}
        user={user}
        message="You need to be logged in to view the security panel."
        useCard={true}
        icon={Shield}
      />
    );
  }

  if (!securityPermissions.canViewSecurity) {
    return (
      <AccessDenied
        isAuthenticated={true}
        hasAccess={false}
        user={user}
        message="You don't have permission to access the security panel."
        useCard={true}
        icon={Shield}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
          <div className="px-4 lg:px-6 mb-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
                  Security Management
                </h1>
                <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
                  Manage IP/HWID blocks and configure security rules
                </p>
              </div>
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
      </div>
    </div>
  );
}

export function SecurityPage() {
  return (
    <SecurityPermissionsProvider>
      <SecurityPageContent />
    </SecurityPermissionsProvider>
  );
}