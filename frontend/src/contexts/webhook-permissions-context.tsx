import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

interface WebhookPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canTest: boolean;
  canViewLogs: boolean;
  canViewWebhooks: boolean;
}

const WebhookPermissionsContext = createContext<WebhookPermissions | undefined>(undefined);

interface WebhookPermissionsProviderProps {
  children: ReactNode;
}

export function WebhookPermissionsProvider({ children }: WebhookPermissionsProviderProps) {
  const { hasPermission } = usePermissions();

  const permissions = useMemo<WebhookPermissions>(() => {
    const canView = hasPermission('webhooks.view');
    const canCreate = hasPermission('webhooks.create');
    const canEdit = hasPermission('webhooks.edit');
    const canDelete = hasPermission('webhooks.delete');
    const canTest = hasPermission('webhooks.test');
    const canViewLogs = hasPermission('webhooks.view_logs');

    const canViewWebhooks = canView || canCreate || canEdit || canDelete || canTest || canViewLogs;

    return {
      canView,
      canCreate,
      canEdit,
      canDelete,
      canTest,
      canViewLogs,
      canViewWebhooks,
    };
  }, [hasPermission]);

  return (
    <WebhookPermissionsContext.Provider value={permissions}>
      {children}
    </WebhookPermissionsContext.Provider>
  );
}

export function useWebhookPermissions(): WebhookPermissions {
  const context = useContext(WebhookPermissionsContext);

  if (context === undefined) {
    throw new Error(
      'useWebhookPermissions must be used within a WebhookPermissionsProvider'
    );
  }

  return context;
}


