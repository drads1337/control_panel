import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
  Edit, 
  Upload, 
  Bell, 
  Settings, 
  Database, 
  GitCommit, 
  FileText 
} from 'lucide-react'
import type { Agent } from '@/entities/agent'
import { cn } from '@/lib/utils.ts'
import AssignProductsDialog from './AssignProductsDialog'
import AgentConfigDialog from './AgentConfigDialog'
import UploadAgentFilesDialog from './UploadAgentFilesDialog'
import { assignProductsToAgent, unassignProductsFromAgent } from '@/entities/agent'

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateString
  }
}

interface ViewAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: Agent | null
  // Actions
  onEdit?: (agent: Agent) => void
  onConfig?: (agent: Agent) => void
  onAssignProducts?: (agent: Agent) => void
  onUpload?: (agent: Agent) => void
  onNotifications?: (agent: Agent) => void
  onChangelog?: (agent: Agent) => void
  // Permissions
  canEdit?: boolean
  canConfigure?: boolean
  canAssignProducts?: boolean
  canUploadFiles?: boolean
  canManageNotifications?: boolean
  canManageChangelog?: boolean
  // Success callback
  onSuccess?: () => void
}

export default function ViewAgentDialog({
  open,
  onOpenChange,
  agent,
  onEdit,
  onConfig,
  onAssignProducts,
  onUpload,
  onNotifications,
  onChangelog,
  canEdit = false,
  canConfigure = false,
  canAssignProducts = false,
  canUploadFiles = false,
  canManageNotifications = false,
  canManageChangelog = false,
  onSuccess,
}: ViewAgentDialogProps) {
  const [showConfigDialog, setShowConfigDialog] = React.useState(false)
  const [showAssignDialog, setShowAssignDialog] = React.useState(false)
  const [showUploadDialog, setShowUploadDialog] = React.useState(false)

  if (!agent) return null

  const handleConfigClick = () => {
    if (onConfig) {
      onConfig(agent)
    } else {
      setShowConfigDialog(true)
    }
  }

  const handleAssignClick = () => {
    if (onAssignProducts) {
      onAssignProducts(agent)
    } else {
      setShowAssignDialog(true)
    }
  }

  const handleUploadClick = () => {
    if (onUpload) {
      onUpload(agent)
    } else {
      setShowUploadDialog(true)
    }
  }

  const handleAssign = async (agentId: number, productIds: number[]) => {
    await assignProductsToAgent(agentId, productIds)
  }

  const handleUnassign = async (agentId: number, productIds: number[]) => {
    await unassignProductsFromAgent(agentId, productIds)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full sm:max-w-[380px] p-0 gap-0 overflow-hidden border-none shadow-xl">
          {/* Compact Header */}
          <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between bg-muted/10">
            <div className="flex items-center gap-2 overflow-hidden">
              <DialogTitle className="text-base font-semibold truncate">
                {agent.name}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-4 space-y-4 text-sm">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-secondary/20 p-2 rounded-md">
                <p className="text-[10px] text-muted-foreground uppercase">Ver</p>
                <p className="font-mono font-medium">{agent.version || '—'}</p>
              </div>
              <div className="bg-secondary/20 p-2 rounded-md">
                <p className="text-[10px] text-muted-foreground uppercase">Downloads</p>
                <p className="font-mono font-medium">{agent.downloads || 0}</p>
              </div>
              <div className="bg-secondary/20 p-2 rounded-md">
                <p className="text-[10px] text-muted-foreground uppercase">Users</p>
                <p className="font-mono font-medium">{agent.active_users || 0}</p>
              </div>
            </div>

            {/* Description (Truncated) */}
            {agent.description && (
              <div className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
                {agent.description}
              </div>
            )}

            {/* Key Details List */}
            <div className="space-y-2 pt-1">
              <InfoRow label="ID" value={agent.id} mono />
              
              {/* Example: If you have an OS or Arch field */}
              {/* <InfoRow label="Architecture" value={agent.arch} /> */}

              {agent.description && (
                <InfoRow label="Description" value={agent.description} />
              )}
              
              {agent.created_at && (
                <InfoRow label="Created" value={formatDate(agent.created_at)} />
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-muted/30 p-2 flex items-center justify-between border-t">
              <div className="flex items-center gap-1">
                {onEdit && canEdit && (
                  <ActionButton icon={Edit} onClick={() => onEdit(agent)} title="Edit Details" />
                )}
                {(onConfig || canConfigure) && canConfigure && (
                  <ActionButton icon={Settings} onClick={handleConfigClick} title="Configuration" />
                )}
                {(onAssignProducts || canAssignProducts) && canAssignProducts && (
                  <ActionButton icon={Database} onClick={handleAssignClick} title="Assign Products" />
                )}
                {(onUpload || canUploadFiles) && canUploadFiles && (
                  <ActionButton icon={Upload} onClick={handleUploadClick} title="Upload Files" />
                )}
                {onNotifications && canManageNotifications && (
                  <ActionButton icon={Bell} onClick={() => onNotifications(agent)} title="Notifications" />
                )}
                {onChangelog && canManageChangelog && (
                  <ActionButton icon={GitCommit} onClick={() => onChangelog(agent)} title="Changelog" />
                )}
              </div>
              
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs px-3">
                Close
              </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Separate Dialogs */}
      {canConfigure && (
        <AgentConfigDialog
          open={showConfigDialog}
          onOpenChange={setShowConfigDialog}
          agent={agent}
          onSuccess={onSuccess}
        />
      )}
      {canAssignProducts && (
        <AssignProductsDialog
          open={showAssignDialog}
          onOpenChange={setShowAssignDialog}
          agent={agent}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onSuccess={onSuccess}
        />
      )}
      {canUploadFiles && (
        <UploadAgentFilesDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          agent={agent}
          onSuccess={onSuccess}
        />
      )}
    </>
  )
}

// Helper components
function InfoRow({ 
  label, 
  value, 
  mono = false, 
  capitalize = false 
}: { 
  label: string, 
  value: string | number, 
  mono?: boolean, 
  capitalize?: boolean 
}) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        "font-medium text-foreground", 
        mono && "font-mono", 
        capitalize && "capitalize"
      )}>
        {value}
      </span>
    </div>
  )
}

function ActionButton({ 
  icon: Icon, 
  onClick, 
  title 
}: { 
  icon: any, 
  onClick: () => void, 
  title: string 
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background"
      title={title}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}