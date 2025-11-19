import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthContext } from '../../contexts/auth-context';
import { Webhook, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { WebhookTable } from './webhook-table';
import { WebhookStats } from './webhook-stats';
import { CreateWebhookDialog } from './create-webhook-dialog';
import { EditWebhookDialog } from './edit-webhook-dialog';
import { WebhookLogsDialog } from './webhook-logs-dialog';
import type { WebhookData, WebhookFormData, WebhookStats as WebhookStatsType, SecretsVisibility } from './types';
import { WEBHOOK_EVENTS } from './constants';
import { webhookAPI } from '@/entities/webhook';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { usePermissions } from '@/hooks/use-permissions';

export default function WebhooksPage() {
  const { isAuthenticated, user } = useAuthContext();
  const { hasPermission } = usePermissions();

  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [stats, setStats] = useState<WebhookStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const [webhooksResponse, statsResponse] = await Promise.allSettled([
        webhookAPI.getWebhooks(),
        webhookAPI.getWebhookStats()
      ]);

      if (webhooksResponse.status === 'fulfilled') {
        setWebhooks(webhooksResponse.value);
      } else {

        if (showLoading) {
          setWebhooks([]);
        }
      }

      if (statsResponse.status === 'fulfilled') {
        setStats(statsResponse.value);
      } else {

        if (showLoading) {
          setStats(null);
        }
      }
    } catch (err: any) {

      const errorMessage = err.response?.data?.error || 'Error loading webhooks data';
      if (showLoading) {
        setError(errorMessage);
        setWebhooks([]);
        setStats(null);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const handleCreateWebhook = async () => {
    if (!hasPermission('webhooks.create')) {
      toast.error("You don't have permission to create webhooks");
      return;
    }

    try {
      const webhookData = {
        ...formData,
        headers: customHeaders.reduce((acc, header) => {
          if (header.key && header.value) {
            acc[header.key] = header.value;
          }
          return acc;
        }, {} as Record<string, string>)
      };

      await webhookAPI.createWebhook(webhookData);
      toast.success('Webhook created successfully');
      setCreateDialogOpen(false);
      resetForm();
      await loadData();
    } catch (err: any) {

      const errorMessage = err.response?.data?.error || 'Error creating webhook';
      toast.error(errorMessage);
      setError(errorMessage);
    }
  };

  const handleEditWebhook = async () => {
    if (!editingWebhook) return;

    if (!hasPermission('webhooks.edit')) {
      toast.error("You don't have permission to edit webhooks");
      return;
    }

    try {
      const webhookData = {
        ...formData,
        headers: customHeaders.reduce((acc, header) => {
          if (header.key && header.value) {
            acc[header.key] = header.value;
          }
          return acc;
        }, {} as Record<string, string>)
      };

      await webhookAPI.updateWebhook(editingWebhook.id, webhookData);
      toast.success('Webhook updated successfully');
      setEditDialogOpen(false);
      setEditingWebhook(null);
      resetForm();
      await loadData();
    } catch (err: any) {

      const errorMessage = err.response?.data?.error || 'Error updating webhook';
      toast.error(errorMessage);
      setError(errorMessage);
    }
  };

  const handleDeleteWebhook = async (webhookId: number) => {
    if (!hasPermission('webhooks.delete')) {
      toast.error("You don't have permission to delete webhooks");
      return;
    }

    try {
      await webhookAPI.deleteWebhook(webhookId);
      toast.success('Webhook deleted successfully');
      await loadData();
    } catch (err: any) {

      const errorMessage = err.response?.data?.error || 'Error deleting webhook';
      toast.error(errorMessage);
      setError(errorMessage);
    }
  };

  const handleTestWebhook = async (webhookId: number) => {
    if (!hasPermission('webhooks.test')) {
      toast.error("You don't have permission to test webhooks");
      return;
    }

    try {
      const result = await webhookAPI.testWebhook(webhookId);
      if (result.success) {
        toast.success('Test webhook sent successfully');
      } else {
        toast.error(`Test webhook failed: ${result.error_message}`);
      }
    } catch (err: any) {

      const errorMessage = err.response?.data?.error || 'Error testing webhook';
      toast.error(errorMessage);
    }
  };

  const handleToggleStatus = async (webhook: WebhookData) => {
    if (!hasPermission('webhooks.edit')) {
      toast.error("You don't have permission to edit webhooks");
      return;
    }

    const newStatus = !webhook.is_active;

    setWebhooks(prevWebhooks => 
      prevWebhooks.map(w => 
        w.id === webhook.id ? { ...w, is_active: newStatus } : w
      )
    );

    if (stats) {
      setStats(prevStats => {
        if (!prevStats) return prevStats;
        const newActiveCount = newStatus 
          ? prevStats.active_webhooks + 1 
          : prevStats.active_webhooks - 1;
        return {
          ...prevStats,
          active_webhooks: Math.max(0, newActiveCount)
        };
      });
    }

    try {
      await webhookAPI.updateWebhook(webhook.id, {
        is_active: newStatus
      });
      toast.success(`Webhook ${webhook.is_active ? 'disabled' : 'enabled'} successfully`);

      webhookAPI.getWebhookStats()
        .then(updatedStats => {
          if (updatedStats) {
            setStats(updatedStats);
          }
        })
        .catch(err => {

        });
    } catch (err: any) {

      const errorMessage = err.response?.data?.error || 'Error updating webhook status';
      toast.error(errorMessage);

      setWebhooks(prevWebhooks => 
        prevWebhooks.map(w => 
          w.id === webhook.id ? { ...w, is_active: webhook.is_active } : w
        )
      );

      if (stats) {
        setStats(prevStats => {
          if (!prevStats) return prevStats;
          const newActiveCount = newStatus 
            ? prevStats.active_webhooks - 1 
            : prevStats.active_webhooks + 1;
          return {
            ...prevStats,
            active_webhooks: Math.max(0, newActiveCount)
          };
        });
      }
    }
  };

  const handleEditClick = (webhook: WebhookData) => {
    if (!hasPermission('webhooks.edit')) {
      toast.error("You don't have permission to edit webhooks");
      return;
    }

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
    if (!hasPermission('webhooks.view_logs')) {
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
    setSecretsVisibility({
      createTelegramToken: false,
      createDiscordToken: false,
      createSecret: false,
      editTelegramToken: false,
      editDiscordToken: false,
      editSecret: false
    });
  };

  const canView = hasPermission('webhooks.view');
  const canCreate = hasPermission('webhooks.create');
  const canEdit = hasPermission('webhooks.edit');
  const canDelete = hasPermission('webhooks.delete');
  const canTest = hasPermission('webhooks.test');
  const canViewLogs = hasPermission('webhooks.view_logs');

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You need to be logged in to view the webhooks panel.
          </p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to view webhooks.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Your roles: {user?.roles?.join(', ') || 'unknown'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Required permissions: webhooks.view
          </p>
        </div>
      </div>
    );
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
    <div className="space-y-6">
      {}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Webhooks</h1>
            <p className="text-muted-foreground mt-2">
              Configure webhooks to receive real-time notifications about events in your system.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => loadData(false)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            {canCreate && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Webhook
              </Button>
            )}
          </div>
        </div>
      </div>

      {}
      {stats && webhooks.length > 0 && <WebhookStats stats={stats} loading={false} />}

      {}
      <WebhookTable
        webhooks={webhooks}
        onCreateClick={() => {
          if (!canCreate) {
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

      {}
      {canCreate && (
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

      {canEdit && (
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

      {canViewLogs && (
        <WebhookLogsDialog
          open={logsDialogOpen}
          onOpenChange={setLogsDialogOpen}
          webhook={viewingLogsWebhook}
        />
      )}
    </div>
  );
}