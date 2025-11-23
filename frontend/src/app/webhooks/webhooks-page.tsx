import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../../contexts/auth-context';
import { WebhookPermissionsProvider, useWebhookPermissions } from '../../contexts/webhook-permissions-context';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { WebhookTable } from './webhook-table';
import { WebhookStats } from './webhook-stats';
import { CreateWebhookDialog } from './create-webhook-dialog';
import { EditWebhookDialog } from './edit-webhook-dialog';
import { WebhookLogsDialog } from './webhook-logs-dialog';
import { WebhookAccessDenied } from './webhook-access-denied';
import { useWebhookActions } from './hooks/use-webhook-actions';
import type { WebhookData, WebhookFormData, SecretsVisibility } from './types';

function WebhooksPageContent() {
  const { isAuthenticated, user, isInitialized } = useAuthContext();
  const webhookPermissions = useWebhookPermissions();

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
  } = useWebhookActions();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookData | null>(null);
  const [viewingLogsWebhook, setViewingLogsWebhook] = useState<WebhookData | null>(null);

  const [formData, setFormData] = useState<WebhookFormData>({
    name: '',
    webhook_type: 'custom',
    url: '',
    events: [],
    secret: '',
    is_active: true,
    headers: {},
    telegram_bot_token: '',
    telegram_chat_id: '',
    discord_webhook_url: '',
    discord_bot_token: '',
    discord_channel_id: ''
  });

  const [secretsVisibility, setSecretsVisibility] = useState<SecretsVisibility>({
    createTelegramToken: false,
    createDiscordToken: false,
    createSecret: false,
    editTelegramToken: false,
    editDiscordToken: false,
    editSecret: false
  });

  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string, value: string }>>([]);
  
  const [originalWebhookData, setOriginalWebhookData] = useState<WebhookData | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const handleCreateWebhook = async () => {
    const success = await createWebhook(formData, customHeaders);
    if (success) {
      setCreateDialogOpen(false);
      resetForm();
    }
  };

  const handleEditWebhook = async () => {
    if (!editingWebhook) return;

    const success = await editWebhook(editingWebhook.id, formData, customHeaders, originalWebhookData);
    if (success) {
      setEditDialogOpen(false);
      setEditingWebhook(null);
      setOriginalWebhookData(null);
      resetForm();
    }
  };

  const handleDeleteWebhook = async (webhookId: number) => {
    await deleteWebhook(webhookId);
  };

  const handleTestWebhook = async (webhookId: number) => {
    await testWebhook(webhookId);
  };

  const handleToggleStatus = async (webhook: WebhookData) => {
    await toggleStatus(webhook);
  };

  const handleEditClick = (webhook: WebhookData) => {
    if (!webhookPermissions.canEdit) {
      toast.error("You don't have permission to edit webhooks");
      return;
    }

    setOriginalWebhookData(webhook);
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      webhook_type: webhook.webhook_type,
      url: webhook.url || '',
      events: webhook.events,
      secret: webhook.secret || '',
      is_active: webhook.is_active,
      headers: webhook.headers || {},
      telegram_bot_token: webhook.telegram_bot_token || '',
      telegram_chat_id: webhook.telegram_chat_id || '',
      discord_webhook_url: webhook.discord_webhook_url || '',
      discord_bot_token: webhook.discord_bot_token || '',
      discord_channel_id: webhook.discord_channel_id || ''
    });

    const headersArray = Object.entries(webhook.headers || {}).map(([key, value]) => ({
      key,
      value
    }));
    setCustomHeaders(headersArray);

    setEditDialogOpen(true);
  };

  const handleLogsClick = (webhook: WebhookData) => {
    if (!webhookPermissions.canViewLogs) {
      toast.error("You don't have permission to view webhook logs");
      return;
    }

    setViewingLogsWebhook(webhook);
    setLogsDialogOpen(true);
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      webhook_type: 'custom',
      url: '',
      events: [],
      secret: '',
      is_active: true,
      headers: {},
      telegram_bot_token: '',
      telegram_chat_id: '',
      discord_webhook_url: '',
      discord_bot_token: '',
      discord_channel_id: ''
    });
    setCustomHeaders([]);
    setOriginalWebhookData(null);
    setSecretsVisibility({
      createTelegramToken: false,
      createDiscordToken: false,
      createSecret: false,
      editTelegramToken: false,
      editDiscordToken: false,
      editSecret: false
    });
  };

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

  if (!webhookPermissions.canViewWebhooks) {
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
      <div className="mb-3 xs:mb-4 sm:mb-5 md:mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">Webhooks</h1>
            <p className="text-xs xs:text-sm sm:text-sm md:text-base text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
              Configure webhooks to receive real-time notifications about events in your system.
            </p>
            {webhookPermissions.canCreate && (
              <div className="mt-2 xs:mt-2.5 sm:mt-3 hidden sm:block">
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Webhook
                </Button>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loading || refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {stats && webhooks.length > 0 && <WebhookStats stats={stats} loading={loading} />}

      <WebhookTable
        webhooks={webhooks}
        onCreateClick={() => {
          if (!webhookPermissions.canCreate) {
            toast.error("You don't have permission to create webhooks");
            return;
          }
          setCreateDialogOpen(true);
        }}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteWebhook}
        onTestClick={handleTestWebhook}
        onToggleStatus={handleToggleStatus}
        onLogsClick={handleLogsClick}
        onCopyToClipboard={handleCopyToClipboard}
      />

      {webhookPermissions.canCreate && (
        <CreateWebhookDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          formData={formData}
          setFormData={setFormData}
          secretsVisibility={secretsVisibility}
          setSecretsVisibility={setSecretsVisibility}
          customHeaders={customHeaders}
          setCustomHeaders={setCustomHeaders}
          saving={loading}
          onCreateWebhook={handleCreateWebhook}
        />
      )}

      {webhookPermissions.canEdit && (
        <EditWebhookDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
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
      )}

      {webhookPermissions.canViewLogs && (
        <WebhookLogsDialog
          open={logsDialogOpen}
          onOpenChange={setLogsDialogOpen}
          webhook={viewingLogsWebhook}
        />
      )}
    </div>
  );
}

export default function WebhooksPage() {
  return (
    <WebhookPermissionsProvider>
      <WebhooksPageContent />
    </WebhookPermissionsProvider>
  );
}