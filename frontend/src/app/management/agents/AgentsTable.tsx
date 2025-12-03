import React from 'react';
import type { Agent } from '@/entities/agent';
import { AgentsList } from './components/AgentsList';

interface AgentsTableProps {
  agents: Agent[];
  selectedAgents: number[];
  onToggleAgentSelection: (agentId: number) => void;
  onViewDetails: (agent: Agent) => void;
  onEditAgent: (agent: Agent) => void;
  onConfigAgent: (agent: Agent) => void;
  onAssignProducts: (agent: Agent) => void;
  onUploadFiles: (agent: Agent) => void;
  onNotificationsProduct: (agent: Agent) => void;
  onChangelogProduct: (agent: Agent) => void;
  onStatusChange: (agentId: number, newStatus: Agent['status']) => void;
  onDeleteAgent: (agentId: number) => void;
  canEditAgents: boolean;
  canDeleteAgents: boolean;
  canUploadFiles: boolean;
  canViewNotifications: boolean;
  canCreateNotifications: boolean;
  canEditNotifications: boolean;
  canViewChangelog: boolean;
  canCreateChangelog: boolean;
  canEditChangelog: boolean;
  canManageStatus: boolean;
  canAssignProducts: boolean;
  canConfigurationSettings: boolean;
}

export const AgentsTable: React.FC<AgentsTableProps> = ({
  agents,
  selectedAgents,
  onToggleAgentSelection,
  onViewDetails,
  onEditAgent,
  onConfigAgent,
  onAssignProducts,
  onUploadFiles,
  onNotificationsProduct,
  onChangelogProduct,
  onStatusChange,
  onDeleteAgent,
  canEditAgents,
  canDeleteAgents,
  canUploadFiles,
  canViewNotifications,
  canCreateNotifications,
  canEditNotifications,
  canViewChangelog,
  canCreateChangelog,
  canEditChangelog,
  canManageStatus,
  canAssignProducts,
  canConfigurationSettings,
}) => {
  return (
    <AgentsList
      agents={agents}
      selectedAgents={selectedAgents}
      onToggleAgentSelection={onToggleAgentSelection}
      onViewDetails={onViewDetails}
      onEditAgent={onEditAgent}
      onConfigAgent={onConfigAgent}
      onAssignProducts={onAssignProducts}
      onUploadFiles={onUploadFiles}
      onNotificationsProduct={onNotificationsProduct}
      onChangelogProduct={onChangelogProduct}
      onStatusChange={onStatusChange}
      onDeleteAgent={onDeleteAgent}
      canEditAgents={canEditAgents}
      canDeleteAgents={canDeleteAgents}
      canUploadFiles={canUploadFiles}
      canViewNotifications={canViewNotifications}
      canCreateNotifications={canCreateNotifications}
      canEditNotifications={canEditNotifications}
      canViewChangelog={canViewChangelog}
      canCreateChangelog={canCreateChangelog}
      canEditChangelog={canEditChangelog}
      canManageStatus={canManageStatus}
      canAssignProducts={canAssignProducts}
      canConfigurationSettings={canConfigurationSettings}
    />
  );
};

