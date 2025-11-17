import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuthContext } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import LicenseKeysFilters from './LicenseKeysFilters';
import LicenseKeysList from './LicenseKeysList';
import LicenseKeyCreationGrid from './LicenseKeyCreationGrid';
import KeyDetailsDialog from './KeyDetailsDialog';
import KeyEditDialog from './KeyEditDialog';
import KeyExtendDialog from './KeyExtendDialog';
import { useKeysManagement } from '@/hooks/use-keys-management';
import { Plus, Database } from 'lucide-react';

interface LicenseKeysMainProps {
  onSwitchToGameDatabase?: () => void;
  activeTab?: string;
}

const LicenseKeysMain: React.FC<LicenseKeysMainProps> = ({ onSwitchToGameDatabase, activeTab }) => {
  const { user } = useAuthContext();
  const { hasPermission } = usePermissions();

  const canViewKeys = hasPermission('keys.view');
  const canCreateKeys = hasPermission('keys.create');
  const canEditKeys = hasPermission('keys.edit');
  const canDeleteKeys = hasPermission('keys.delete');
  const canGenerateKeys = hasPermission('keys.generate');
  const canResetPcBinding = hasPermission('keys.reset_pc_binding');
  const canPauseResume = hasPermission('keys.pause_resume');
  const canExtend = hasPermission('keys.extend');
  const canBlock = hasPermission('keys.block');
  const canManage = hasPermission('keys.manage');

  const [viewMode, setViewMode] = useState<'my' | 'all'>('my'); // 'my' or 'all'
  const [filters, setFilters] = useState({ status: 'all', gameId: 'all', search: '' });
  const [currentPage, setCurrentPage] = useState(1);

  // Determine default view mode based on permissions
  useEffect(() => {
    // If user has view permission, default to 'all' but allow switching
    if (canViewKeys) {
      setViewMode('all');
    } else {
      setViewMode('my');
    }
  }, [canViewKeys]);

  // Reset to page 1 when filters or view mode change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, viewMode]);

  // Use the management hook
  const {
    keys,
    loading,
    games,
    pagination,
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
    loadGames,
    setDetailsDialogOpen,
    setEditDialogOpen,
    setExtendDialogOpen,
    setSelectedKey,
  } = useKeysManagement({
    viewMode,
    filters,
    currentPage,
    canViewKeys,
  });

  // Reload games when switching to license-keys tab (after creating a game)
  useEffect(() => {
    if (activeTab === 'license-keys') {
      loadGames();
    }
  }, [activeTab, loadGames]);

  const handleClearFilters = () => {
    setFilters({ status: 'all', gameId: 'all', search: '' });
  };

  // Check if user has any key-related permission
  const hasAnyKeyPermission = canViewKeys || canCreateKeys || canEditKeys || canDeleteKeys || 
                               canGenerateKeys || canResetPcBinding || canPauseResume || 
                               canExtend || canBlock || canManage;
  
  if (!hasAnyKeyPermission) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">Access Denied</div>
          <div className="text-gray-500">You don't have permission to access license keys.</div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="p-8">
        <Spinner message="Loading..." />
      </div>
    );
  }

  // Show "No Applications Found" state when there are no games
  if (games.length === 0) {
    return (
      <div className="space-y-6">
        {/* Empty State - No Applications */}
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">No Applications Yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                Get started by creating your first application. You can manage settings, upload files, and track usage.
              </p>
              <Button 
                onClick={() => onSwitchToGameDatabase?.()}
                className="gap-2"
                size="lg"
              >
                <Plus className="h-5 w-5" />
                Create Your First Application
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* License Key Creation Interface - 2x2 Grid */}
      <ConditionalRender permission="keys.create" fallback={null}>
        <LicenseKeyCreationGrid games={games} onKeyCreated={handleKeyCreated} />
      </ConditionalRender>

      {/* Filters */}
      <LicenseKeysFilters
        filters={filters}
        onFiltersChange={setFilters}
        games={games}
        onClearFilters={handleClearFilters}
      />

      {/* Keys List */}
          <LicenseKeysList
            keys={keys}
            loading={loading}
            showKey={showKey}
            fullKeys={fullKeys}
            selectedKeys={selectedKeys}
            actionLoading={actionLoading}
            pagination={pagination}
            onToggleKeyVisibility={handleToggleKeyVisibility}
            onSelectKey={handleSelectKey}
            onSelectAll={handleSelectAll}
            onKeyAction={handleKeyAction}
            onViewDetails={handleViewDetails}
            onPageChange={(page) => setCurrentPage(page)}
            canEdit={canEditKeys}
            canDelete={canDeleteKeys}
            canReset={canResetPcBinding}
            canPauseResume={canPauseResume}
            canExtend={canExtend}
            canBlock={canBlock}
            canGenerate={canGenerateKeys}
            canManage={canManage}
            canViewAll={canViewKeys}
            viewMode={viewMode}
            onViewModeChange={canViewKeys ? setViewMode : undefined}
            currentUserId={user?.id}
          />

      {/* Dialogs */}
      <KeyDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        keyData={selectedKey}
        keyId={selectedKey?.id}
      />

      <KeyEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        keyData={selectedKey}
        onSuccess={handleDialogSuccess}
      />

      <KeyExtendDialog
        open={extendDialogOpen}
        onOpenChange={setExtendDialogOpen}
        keyData={selectedKey}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
};

export default LicenseKeysMain;