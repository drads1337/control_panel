"use client"

import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Copy, 
  Send, 
  AlertTriangle,
  RefreshCw,
  Edit,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { useWebhookActions, useWebhookDialogs } from './hooks'
import type { WebhookData } from './types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CreateWebhookDialog, EditWebhookDialog, WebhookStats } from './components'
import { EmptyState, AccessDenied } from '@/shared/ui/components'
import { useAuthContext } from '@/app/providers/auth-provider'
import { usePermissions } from '@/shared/hooks/use-permissions'

// --- Sub-components ---

const StatusBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(
        "w-2 h-2 rounded-full",
        isActive ? "bg-green-500" : "bg-destructive"
      )}></span>
      <span className={cn(
        "text-xs font-medium capitalize",
        isActive ? "text-green-700 dark:text-green-400" : "text-destructive"
      )}>
        {isActive ? 'active' : 'inactive'}
      </span>
    </div>
  )
}


export function WebhooksPage() {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const { hasPermission } = usePermissions()
  
  const { 
    webhooks, 
    loading, 
    error,
    loadData, 
    handleToggleStatus, 
    handleDeleteWebhook, 
    handleTestWebhook 
  } = useWebhookActions()
  
  const { 
    createDialogOpen,
    editDialogOpen,
    editingWebhook,
    openCreateDialog, 
    closeCreateDialog,
    openEditDialog, 
    closeEditDialog,
    formData,
    setFormData,
    secretsVisibility,
    setSecretsVisibility,
    customHeaders,
    setCustomHeaders,
    originalWebhookData
  } = useWebhookDialogs()

  const canViewWebhooks = hasPermission('webhooks.view')

  // Load webhooks on mount
  useEffect(() => {
    if (isInitialized && isAuthenticated && canViewWebhooks) {
      loadData()
    }
  }, [loadData, isInitialized, isAuthenticated, canViewWebhooks])

  if (!isInitialized) {
    return null
  }

  if (!isAuthenticated || !user) {
    return (
      <AccessDenied
        isAuthenticated={false}
        hasAccess={false}
        user={user}
        message="You need to be logged in to view webhooks."
        useCard={true}
      />
    )
  }
  
  if (!canViewWebhooks) {
    return (
      <AccessDenied
        isAuthenticated={true}
        hasAccess={false}
        user={user}
        message="You don't have permission to view webhooks."
        useCard={true}
      />
    )
  }

  const handleDelete = async (webhookId: number) => {
    if (confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) {
      await handleDeleteWebhook(webhookId)
    }
  }

  // Render dialogs outside of conditional returns so they're always available
  const dialogComponent = (
    <>
      <CreateWebhookDialog
        open={createDialogOpen}
        onOpenChange={closeCreateDialog}
        formData={formData}
        setFormData={setFormData}
        customHeaders={customHeaders}
        setCustomHeaders={setCustomHeaders}
        secretsVisibility={secretsVisibility}
        setSecretsVisibility={setSecretsVisibility}
        onSuccess={() => {
          loadData()
        }}
      />
      {editingWebhook && (
        <EditWebhookDialog
          open={editDialogOpen}
          onOpenChange={closeEditDialog}
          editingWebhook={editingWebhook}
          formData={formData}
          setFormData={setFormData}
          customHeaders={customHeaders}
          setCustomHeaders={setCustomHeaders}
          secretsVisibility={secretsVisibility}
          setSecretsVisibility={setSecretsVisibility}
          originalWebhookData={originalWebhookData}
          onSuccess={() => {
            loadData()
          }}
        />
      )}
    </>
  )

  return (
    <>
      {dialogComponent}
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
            {/* Header Section */}
            <div className="px-4 lg:px-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
                    Webhooks
                  </h1>
                  <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
                    Manage webhook endpoints and monitor delivery status.
                  </p>
                </div>
                {hasPermission('webhooks.create') && (
                  <Button
                    onClick={openCreateDialog}
                    size="sm"
                    className="h-8 text-xs gap-1.5 shrink-0"
                  >
                    <Plus className="size-3" />
                    Create Webhook
                  </Button>
                )}
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="px-4 lg:px-6">
              <WebhookStats webhooks={webhooks} loading={loading} />
            </div>

            {/* Error State */}
            {error && (
              <div className="px-4 lg:px-6">
                <div className="flex flex-col items-center justify-center gap-4 p-6 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  <div className="text-center">
                    <h2 className="text-lg font-bold mb-2">Error loading webhooks</h2>
                    <p className="text-sm text-muted-foreground mb-4">{error}</p>
                    <Button onClick={() => loadData()} variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && !error && (
              <div className="px-4 lg:px-6">
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && webhooks.length === 0 && (
              <div className="px-4 lg:px-6">
                <EmptyState
                  title="No webhooks yet"
                  description="Create your first webhook endpoint to receive real-time event notifications."
                  actionLabel="Create Webhook"
                  onAction={openCreateDialog}
                  icon={Plus}
                />
              </div>
            )}

            {/* Table */}
            {!loading && !error && webhooks.length > 0 && (
              <div className="px-4 lg:px-6">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooks.map((webhook) => {
                        const displayUrl = webhook.webhook_type === 'custom' 
                          ? webhook.url 
                          : webhook.webhook_type === 'telegram'
                          ? `Telegram: ${webhook.telegram_chat_id || 'N/A'}`
                          : `Discord: ${webhook.discord_channel_id || 'N/A'}`

                        return (
                          <TableRow key={webhook.id}>
                            <TableCell className="font-medium">{webhook.name}</TableCell>
                            <TableCell>
                              <span className="capitalize">{webhook.webhook_type}</span>
                            </TableCell>
                            <TableCell>
                              <StatusBadge isActive={webhook.is_active} />
                            </TableCell>
                            <TableCell>
                              {displayUrl ? (
                                <div className="flex items-center gap-1 max-w-[200px]">
                                  <span className="text-xs font-mono truncate">{displayUrl}</span>
                                  {webhook.webhook_type === 'custom' && webhook.url && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        navigator.clipboard.writeText(webhook.url!)
                                        toast.success('URL copied to clipboard')
                                      }}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Copy className="size-3" />
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(webhook)}
                                  className="h-8 w-8"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleToggleStatus(webhook)}
                                  className="h-8 w-8"
                                >
                                  {webhook.is_active ? (
                                    <AlertTriangle className="h-4 w-4" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleTestWebhook(webhook.id)}
                                  className="h-8 w-8"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(webhook.id)}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default WebhooksPage

