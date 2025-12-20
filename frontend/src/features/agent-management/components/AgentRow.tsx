import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Container, Check } from 'lucide-react';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import { sanitizeString } from '@/lib/utils/sanitization';
import type { Agent } from '@/entities/agent';
import { AgentSelectionCheckbox } from './AgentSelectionCheckbox';
import { AgentActions } from './AgentActions';
import { cn } from '@/lib/utils';

interface AgentRowProps {
  agent: Agent;
  isSelected: boolean;
  onToggleSelection: (agentId: number) => void;
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

export const AgentRow: React.FC<AgentRowProps> = React.memo(({
  agent,
  isSelected,
  onToggleSelection,
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
  const statusType = agent.status as StatusType;

  return (
    <div className={cn(
      "flex items-center justify-between p-3 border-b transition-colors",
      isSelected ? "bg-accent/40" : "hover:bg-accent/30"
    )}>
      <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
        <AgentSelectionCheckbox
          agentId={agent.id}
          isSelected={isSelected}
          onToggleSelection={onToggleSelection}
        />
        
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          {agent.logo ? (
            <img src={agent.logo} alt={agent.name} className="w-7 h-7 rounded" />
          ) : (
            <Container className="h-5 w-5 text-primary" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm truncate max-w-[200px] sm:max-w-xs">
              {sanitizeString(agent.name)}
            </h4>
            {isSelected && (
              <Check className="h-3 w-3 text-primary shrink-0" />
            )}
            <span className={cn("shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border", getStatusClasses(statusType))}>
              {getStatusText(statusType)}
            </span>
          </div>
          
          {agent.description && (
            <p className="text-xs text-muted-foreground truncate mb-1.5 max-w-[300px] md:max-w-[400px]">
              {sanitizeString(agent.description)}
            </p>
          )}
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {/* Version - Always visible */}
            <span className="font-medium text-foreground/80">v{agent.version}</span>
            
            {/* ID - Hidden on tablets, visible on large screens */}
            <span className="hidden xl:inline-flex items-center gap-2">
               <span>•</span>
               <span className="font-sans text-[10px] opacity-70">ID: {agent.id}</span>
            </span>

            {/* Stats - Hidden on smaller laptops/tablets, visible on XL screens */}
            <span className="hidden 2xl:inline-flex items-center gap-2">
              <span>•</span>
              <span>{agent.downloads.toLocaleString()} downloads</span>
              <span>•</span>
              <span>{agent.active_users.toLocaleString()} users</span>
            </span>
          </div>
        </div>
      </div>
      
      {/* Actions Component - Handles its own responsiveness (Dropdown vs Icons) */}
      <AgentActions
        agent={agent}
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
    </div>
  );
});

AgentRow.displayName = 'AgentRow';

