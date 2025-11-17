import React, { useState } from 'react';
import { useAuthContext } from '../../contexts/auth-context';
import { SecurityPermissionsProvider, useSecurityPermissions } from '../../contexts/security-permissions-context';
import SecurityTabs from './security-tabs';
import { useSecurityActions } from './hooks/use-security-actions';
import { SecurityAccessDenied } from './security-access-denied';

function SecurityPageContent() {
  const { isAuthenticated, user } = useAuthContext();
  const securityPermissions = useSecurityPermissions();
  
  // State for security tabs
  const [activeTab, setActiveTab] = useState('blocked-ips');
  const [ipSearchTerm, setIPSearchTerm] = useState('');
  const [hwidSearchTerm, setHWIDSearchTerm] = useState('');
  
  // Use custom hook for security actions and data
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
  } = useSecurityActions();

  if (!isAuthenticated || !user) {
    return <SecurityAccessDenied message="You need to be logged in to view the security panel." />;
  }
  
  if (!securityPermissions.canViewSecurity) {
    return <SecurityAccessDenied message="You don't have permission to access the security panel." />;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold">Security Panel</h1>
            <p className="text-muted-foreground">
              Manage clients, IP/HWID blocks and configure security rules.
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