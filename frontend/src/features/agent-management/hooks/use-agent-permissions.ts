import { useMemo } from 'react';
import { usePermissions } from '@/shared/hooks/use-permissions';

export function useAgentPermissions() {
  const { hasPermission, hasAnyPermission } = usePermissions();

  const hasAnyAgentPermission = hasAnyPermission([
    'agents.view',
    'agents.create',
    'agents.edit',
    'agents.delete',
    'agents.upload_files',
    'agents.notifications_view',
    'agents.notifications_create',
    'agents.notifications_edit',
    'agents.changelog_view',
    'agents.changelog_create',
    'agents.changelog_edit',
    'agents.status',
    'agents.assign_products',
    'agents.configuration_settings',
  ]);

  const permissions = useMemo(
    () => ({
      canViewAgents: hasPermission('agents.view'),
      canCreateAgents: hasPermission('agents.create'),
      canEditAgents: hasPermission('agents.edit'),
      canDeleteAgents: hasPermission('agents.delete'),
      canUploadFiles: hasPermission('agents.upload_files'),
      canViewNotifications: hasPermission('agents.notifications_view'),
      canCreateNotifications: hasPermission('agents.notifications_create'),
      canEditNotifications: hasPermission('agents.notifications_edit'),
      canViewChangelog: hasPermission('agents.changelog_view'),
      canCreateChangelog: hasPermission('agents.changelog_create'),
      canEditChangelog: hasPermission('agents.changelog_edit'),
      canManageStatus: hasPermission('agents.status'),
      canAssignProducts: hasPermission('agents.assign_products'),
      canConfigurationSettings: hasPermission('agents.configuration_settings'),
      hasAnyAgentPermission,
    }),
    [hasPermission, hasAnyPermission, hasAnyAgentPermission]
  );

  return permissions;
}

