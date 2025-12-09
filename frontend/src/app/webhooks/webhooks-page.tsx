import React, { useEffect } from 'react'
import { useAuthContext } from '../../contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { Plus, RefreshCw } from 'lucide-react'
import { WebhookTable } from './webhook-table'
import { WebhookStats } from './webhook-stats'
import { CreateWebhookDialog } from './create-webhook-dialog'
import { EditWebhookDialog } from './edit-webhook-dialog'
import { WebhookLogsDialog } from './webhook-logs-dialog'
import { WebhookAccessDenied } from './webhook-access-denied'
import { useWebhookActions } from './hooks/use-webhook-actions'
import { useWebhookDialogs } from './hooks/use-webhook-dialogs'
import { WebhooksPageHeader } from './components/webhooks-page-header'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import { usePermissions } from '@/hooks/use-permissions'
import type { WebhookData } from './types'

function WebhooksPageContent() {
  const { isAuthenticated, isInitialized, user } = useAuthContext()
  const { hasPermission, hasAnyPermission } = usePermissions()

  const {
    webhooks,
    stats,
    loading,
    refreshing,
    error,
    loadData,
    handleCreateWebhook: createWebhook,
    handleEditWebhook: editWebhook,
    handleDeleteWebhook: deleteWebhook,
    handleTestWebhook: testWebhook,
    handleToggleStatus: toggleStatus,
    handleRefresh,
  } = useWebhookActions()

  const {
    createDialogOpen,
    editDialogOpen,
    logsDialogOpen,
    editingWebhook,
    viewingLogsWebhook,
    formData,
    setFormData,
    secretsVisibility,
    setSecretsVisibility,
    customHeaders,
    setCustomHeaders,
    originalWebhookData,
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
    openLogsDialog,
    closeLogsDialog,
    resetForm
  } = useWebhookDialogs()

  useEffect(() => {
    if (isAuthenticated) {
      loadData()
    }
  }, [isAuthenticated, loadData])

  const handleCreateWebhook = async () => {
    const success = await createWebhook(formData, customHeaders)
    if (success) {
      closeCreateDialog()
    }
  }

  const handleEditWebhook = async () => {
    if (!editingWebhook) return

    const success = await editWebhook(editingWebhook.id, formData, customHeaders, originalWebhookData)
    if (success) {
      closeEditDialog()
    }
  }

  const handleDeleteWebhook = async (webhookId: number) => {
    await deleteWebhook(webhookId)
  }

  const handleTestWebhook = async (webhookId: number) => {
    await testWebhook(webhookId)
  }

  const handleToggleStatus = async (webhook: WebhookData) => {
    await toggleStatus(webhook)
  }

  const handleEditClick = (webhook: WebhookData) => {
    if (!hasPermission('webhooks.edit')) {
      toast.error("You don't have permission to edit webhooks")
      return
    }
    openEditDialog(webhook)
  }

  const handleLogsClick = (webhook: WebhookData) => {
    if (!hasPermission('webhooks.view_logs')) {
      toast.error("You don't have permission to view webhook logs")
      return
    }
    openLogsDialog(webhook)
  }

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Initializing...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <WebhookAccessDenied message="You need to be logged in to view the webhooks panel." />;
  }

  // Check if user has any webhook permission
  const hasAnyWebhookPermission = hasAnyPermission([
    'webhooks.view',
    'webhooks.create',
    'webhooks.edit',
    'webhooks.delete',
    'webhooks.test',
    'webhooks.view_logs'
  ])

  if (!hasAnyWebhookPermission) {
    return <WebhookAccessDenied message="You don't have permission to access the webhooks panel." />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" message="Loading webhooks..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-destructive">Error Loading Webhooks</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => loadData()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6 px-2 xs:px-3 sm:px-4 md:px-0">
      <WebhooksPageHeader />

      {stats && <WebhookStats stats={stats} loading={loading} />}


      <WebhookTable
        webhooks={webhooks}
        onCreateClick={() => {
          if (!hasPermission('webhooks.create')) {
            toast.error("You don't have permission to create webhooks")
            return
          }
          openCreateDialog()
        }}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteWebhook}
        onTestClick={handleTestWebhook}
        onToggleStatus={handleToggleStatus}
        onLogsClick={handleLogsClick}
        onCopyToClipboard={handleCopyToClipboard}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <ConditionalRender permission="webhooks.create" fallback={null}>
        <CreateWebhookDialog
          open={createDialogOpen}
          onOpenChange={closeCreateDialog}
          formData={formData}
          setFormData={setFormData}
          secretsVisibility={secretsVisibility}
          setSecretsVisibility={setSecretsVisibility}
          customHeaders={customHeaders}
          setCustomHeaders={setCustomHeaders}
          saving={loading}
          onCreateWebhook={handleCreateWebhook}
        />
      </ConditionalRender>

      <ConditionalRender permission="webhooks.edit" fallback={null}>
        <EditWebhookDialog
          open={editDialogOpen}
          onOpenChange={closeEditDialog}
          editingWebhook={editingWebhook}
          formData={formData}
          setFormData={setFormData}
          secretsVisibility={secretsVisibility}
          setSecretsVisibility={setSecretsVisibility}
          customHeaders={customHeaders}
          setCustomHeaders={setCustomHeaders}
          saving={loading}
          onUpdateWebhook={handleEditWebhook}
        />
      </ConditionalRender>

      <ConditionalRender permission="webhooks.view_logs" fallback={null}>
        <WebhookLogsDialog
          open={logsDialogOpen}
          onOpenChange={closeLogsDialog}
          webhook={viewingLogsWebhook}
        />
      </ConditionalRender>
    </div>
  );
}

export default function WebhooksPage() {
  return <WebhooksPageContent />
}