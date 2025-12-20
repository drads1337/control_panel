import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Edit,
  Trash2,
  Upload,
  Bell,
  GitCommit,
  Eye,
  Settings,
  Database,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import type { Agent } from '@/entities/agent';

interface AgentActionsProps {
  agent: Agent;
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

export const AgentActions: React.FC<AgentActionsProps> = React.memo(({
  agent,
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
    <div className="flex items-center justify-end gap-2">
      {/* Status Select - Always visible but shrinks on smaller screens */}
      {canManageStatus && (
        <Select
          value={agent.status}
          onValueChange={(value) => onStatusChange(agent.id, value as Agent['status'])}
        >
          <SelectTrigger className="w-[100px] xl:w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="testing">Testing</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Minimalistic: Only Edit visible, rest in dropdown */}
      {canEditAgents && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEditAgent(agent)}
          title="Edit Agent"
        >
          <Edit className="h-4 w-4" />
        </Button>
      )}

      {/* All other actions in dropdown menu */}
      <div className="flex">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <ConditionalRender permission="agents.view" fallback={null}>
              <DropdownMenuItem onClick={() => onViewDetails(agent)}>
                <Eye className="mr-2 h-4 w-4" /> View Details
              </DropdownMenuItem>
            </ConditionalRender>

            {canConfigurationSettings && (
              <DropdownMenuItem onClick={() => onConfigAgent(agent)}>
                <Settings className="mr-2 h-4 w-4" /> Configuration
              </DropdownMenuItem>
            )}

            {canAssignProducts && (
              <DropdownMenuItem onClick={() => onAssignProducts(agent)}>
                <Database className="mr-2 h-4 w-4" /> Assign Products
              </DropdownMenuItem>
            )}

            {canUploadFiles && (
              <DropdownMenuItem onClick={() => onUploadFiles(agent)}>
                <Upload className="mr-2 h-4 w-4" /> Upload Files
              </DropdownMenuItem>
            )}

            {(canViewNotifications || canCreateNotifications || canEditNotifications) && (
              <DropdownMenuItem onClick={() => onNotificationsProduct(agent)}>
                <Bell className="mr-2 h-4 w-4" /> Notifications
              </DropdownMenuItem>
            )}

            {(canViewChangelog || canCreateChangelog || canEditChangelog) && (
              <DropdownMenuItem onClick={() => onChangelogProduct(agent)}>
                <GitCommit className="mr-2 h-4 w-4" /> Changelog
              </DropdownMenuItem>
            )}

            {canDeleteAgents && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDeleteAgent(agent.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

AgentActions.displayName = 'AgentActions';

