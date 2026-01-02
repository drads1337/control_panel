import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuthContext } from '@/app/providers/auth-provider';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { AccessDenied } from '@/shared/ui/components';
import { useKeysManagement } from './hooks/use-keys-management';
import { Plus, Database } from 'lucide-react';
import LicenseKeysFilters from './LicenseKeysFilters';
import LicenseKeysList from './LicenseKeysList';
import LicenseKeyCreationGrid from './LicenseKeyCreationGrid';
import KeyDetailsDialog from './KeyDetailsDialog';
import KeyEditExtendDialog from './KeyEditExtendDialog';

interface LicenseKeysMainProps {
  onSwitchToProductDatabase?: () => void;
  activeTab?: string;
}

const LicenseKeysMain: React.FC<LicenseKeysMainProps> = ({ onSwitchToProductDatabase, activeTab }) => {
  const { user, isAuthenticated, isInitialized } = useAuthContext();
  const { hasPermission } = usePermissions();

  // Мемоизируем все проверки разрешений
  const permissions = useMemo(() => ({
    canViewKeys: hasPermission('keys.view'),
    canCreateKeys: hasPermission('keys.create'),
    canEditKeys: hasPermission('keys.edit'),
    canDeleteKeys: hasPermission('keys.delete'),
    canGenerateKeys: hasPermission('keys.generate'),
    canResetPcBinding: hasPermission('keys.reset_pc_binding'),
    canPauseResume: hasPermission('keys.pause_resume'),
    canExtend: hasPermission('keys.extend'),
    canBlock: hasPermission('keys.block'),
    canManage: hasPermission('keys.manage'),
  }), [hasPermission]);

  const {
    canViewKeys,
    canCreateKeys,
    canEditKeys,
    canDeleteKeys,
    canGenerateKeys,
    canResetPcBinding,
    canPauseResume,
    canExtend,
    canBlock,
    canManage,
  } = permissions;

  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [filters, setFilters] = useState({ status: 'all', productId: 'all', search: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (canViewKeys) {
      setViewMode('all');
    } else {
      setViewMode('my');
    }
  }, [canViewKeys]);

  useEffect(() => {
    setCurrentPage(1);
    setIsInitialLoad(true);
  }, [filters, viewMode]);

  // Загружаем данные только когда таб активен
  const isTabActive = activeTab === 'license-keys';
  
  const {
    keys,
    loading,
    products,
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
    loadProducts,
    setDetailsDialogOpen,
    setEditDialogOpen,
    setExtendDialogOpen,
    setSelectedKey,
  } = useKeysManagement({
    viewMode,
    filters,
    currentPage,
    canViewKeys,
    enabled: isTabActive, // Загружаем данные только если таб активен
  });

  useEffect(() => {
    if (!loading && keys.length > 0) {
      setIsInitialLoad(false);
    }
  }, [loading, keys.length]);

  const productsLoadedRef = React.useRef(false);

  // Загружаем продукты только когда таб активен
  useEffect(() => {
    if (isTabActive && !productsLoadedRef.current && products.length === 0) {
      loadProducts();
      productsLoadedRef.current = true;
    }
  }, [isTabActive, loadProducts, products.length]);

  // Мемоизируем колбэки для оптимизации - ВСЕ ХУКИ ДОЛЖНЫ БЫТЬ ПЕРЕД УСЛОВНЫМИ ВОЗВРАТАМИ
  const handleClearFilters = useCallback(() => {
    setFilters({ status: 'all', productId: 'all', search: '' });
  }, []);

  const handleFiltersChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleViewModeChange = useCallback((mode: 'my' | 'all') => {
    if (canViewKeys) {
      setViewMode(mode);
    }
  }, [canViewKeys]);

  const hasAnyKeyPermission = useMemo(() => 
    canViewKeys || canCreateKeys || canEditKeys || canDeleteKeys || canGenerateKeys || canResetPcBinding || canPauseResume || canExtend || canBlock || canManage,
    [canViewKeys, canCreateKeys, canEditKeys, canDeleteKeys, canGenerateKeys, canResetPcBinding, canPauseResume, canExtend, canBlock, canManage]
  );

  // Условные возвраты только ПОСЛЕ всех хуков
  if (!isInitialized) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return (
      <AccessDenied
        isAuthenticated={false}
        hasAccess={false}
        user={user}
        message="You need to be logged in to access license keys."
        useCard={true}
      />
    );
  }

  if (!hasAnyKeyPermission) {
    return (
      <AccessDenied
        isAuthenticated={true}
        hasAccess={false}
        user={user}
        message="You don't have permission to access license keys."
        useCard={true}
      />
    );
  }

  if (loading && keys.length === 0 && isInitialLoad) {
    return (
      <div className="p-8">
        <Spinner />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database className="size-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">No Products Yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                Get started by creating your first product. You can manage settings, upload files, and track usage.
              </p>
              <ConditionalRender permission="products.create" fallback={null}>
                <Button 
                  onClick={() => onSwitchToProductDatabase?.()}
                  className="gap-2"
                  size="lg"
                >
                  <Plus className="size-5" />
                  Create Your First Product
                </Button>
              </ConditionalRender>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 sm:pb-0">
      <ConditionalRender permission="keys.create" fallback={null}>
        <LicenseKeyCreationGrid products={products} onKeyCreated={handleKeyCreated} />
      </ConditionalRender>

      <LicenseKeysFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        products={products}
        onClearFilters={handleClearFilters}
        viewMode={viewMode}
        onViewModeChange={canViewKeys ? handleViewModeChange : undefined}
        canViewAll={canViewKeys}
      />

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
        onPageChange={handlePageChange}
        canEdit={canEditKeys}
        canDelete={canDeleteKeys}
        canReset={canResetPcBinding}
        canPauseResume={canPauseResume}
        canBlock={canBlock}
        canManage={canManage}
        currentUserId={user?.id}
      />

      <KeyDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        keyData={selectedKey}
        keyId={selectedKey?.id}
      />

      <KeyEditExtendDialog
        open={editDialogOpen || extendDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialogOpen(false);
            setExtendDialogOpen(false);
          }
        }}
        keyData={selectedKey}
        onSuccess={handleDialogSuccess}
        initialTab={extendDialogOpen && !editDialogOpen ? 'extend' : 'edit'}
      />
    </div>
  );
};

export default LicenseKeysMain;

