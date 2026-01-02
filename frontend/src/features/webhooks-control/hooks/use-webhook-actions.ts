import { useState, useCallback, useEffect } from 'react';
import { usePermissions } from '@/shared/hooks';
import { webhookAPI } from '@/entities/webhook';
import { toast } from 'sonner';
import { getErrorMessage, isAxiosError } from '@/shared/lib/utils/error-utils';
import { filterMaskedValues } from '@/shared/lib/webhook-utils';
import type { WebhookData, WebhookFormData, WebhookStats } from '../types';

export function useWebhookActions() {
  const { hasPermission } = usePermissions();

  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const webhooksData = webhooksResponse.value;
        console.log('Webhooks loaded:', { count: webhooksData?.length, data: webhooksData });
        setWebhooks(webhooksData || []);
      } else {
        const reason = webhooksResponse.reason;
        console.error('Failed to load webhooks:', reason);
        
        // Extract error message from the rejection reason
        let errorMessage = 'Failed to load webhooks';
        if (isAxiosError(reason) && reason.response?.data) {
          const errorData = reason.response.data as { error?: string };
          errorMessage = errorData.error || errorMessage;
        } else if (reason instanceof Error) {
          errorMessage = reason.message;
        }
        
        if (showLoading) {
          setError(errorMessage);
          setWebhooks([]);
        } else {
          toast.error(errorMessage);
        }
      }

      if (statsResponse.status === 'fulfilled') {
        setStats(statsResponse.value);
      } else {
        if (showLoading) {
          setStats(null);
        }
      }
    } catch (err: unknown) {
      let errorMessage = 'Error loading webhooks data';
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
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

  const handleCreateWebhook = useCallback(async (
    formData: WebhookFormData,
    customHeaders: Array<{ key: string, value: string }>
  ) => {
    if (!hasPermission('webhooks.create')) {
      toast.error("You don't have permission to create webhooks");
      return false;
    }

    try {
      // Prepare headers
      const headers = customHeaders.reduce((acc, header) => {
        if (header.key && header.value) {
          acc[header.key] = header.value;
        }
        return acc;
      }, {} as Record<string, string>);

      // Build webhook data based on type, removing empty strings
      const webhookData: any = {
        name: formData.name.trim(),
        webhook_type: formData.webhook_type,
        events: formData.events,
        is_active: formData.is_active,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      };

      // Add secret if provided
      if (formData.secret && formData.secret.trim()) {
        webhookData.secret = formData.secret.trim();
      }

      // Add fields based on webhook type
      if (formData.webhook_type === 'custom') {
        if (formData.url && formData.url.trim()) {
          webhookData.url = formData.url.trim();
        }
      } else if (formData.webhook_type === 'telegram') {
        if (formData.telegram_bot_token && formData.telegram_bot_token.trim()) {
          webhookData.telegram_bot_token = formData.telegram_bot_token.trim();
        }
        if (formData.telegram_chat_id && formData.telegram_chat_id.trim()) {
          webhookData.telegram_chat_id = formData.telegram_chat_id.trim();
        }
      } else if (formData.webhook_type === 'discord') {
        if (formData.discord_webhook_url && formData.discord_webhook_url.trim()) {
          webhookData.discord_webhook_url = formData.discord_webhook_url.trim();
        }
        if (formData.discord_bot_token && formData.discord_bot_token.trim()) {
          webhookData.discord_bot_token = formData.discord_bot_token.trim();
        }
        if (formData.discord_channel_id && formData.discord_channel_id.trim()) {
          webhookData.discord_channel_id = formData.discord_channel_id.trim();
        }
      }

      // Remove undefined values
      Object.keys(webhookData).forEach(key => {
        if (webhookData[key] === undefined) {
          delete webhookData[key];
        }
      });

      console.log('Sending webhook data:', webhookData);

      await webhookAPI.createWebhook(webhookData);
      toast.success('Webhook created successfully');
      await loadData(false);
      return true;
    } catch (err: unknown) {
      let errorMessage = 'Error creating webhook';
      if (isAxiosError(err)) {
        console.error('Webhook creation error:', err);
        
        // Network errors (server unreachable, connection refused, etc.)
        if (err.code === 'ERR_NETWORK' || err.code === 'ERR_ADDRESS_UNREACHABLE' || err.message === 'Network Error') {
          errorMessage = 'Cannot connect to server. Please check your network connection and ensure the server is running.';
        } else if (err.response?.data) {
          // Server responded with error
          const errorData = err.response.data as { error?: string; detail?: string | Array<{ msg: string; loc: string[] }> }
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              // Pydantic validation errors
              errorMessage = errorData.detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ');
            } else {
              errorMessage = String(errorData.detail);
            }
          } else {
            errorMessage = `HTTP ${err.response.status}: ${err.response.statusText}`;
          }
        } else if (err.response) {
          // Response without data
          errorMessage = `HTTP ${err.response.status}: ${err.response.statusText || 'Unknown error'}`;
        } else {
          errorMessage = getErrorMessage(err);
        }
      } else {
        errorMessage = getErrorMessage(err);
      }
      toast.error(errorMessage);
      console.error('Full error:', err);
      return false;
    }
  }, [hasPermission, loadData]);

  const handleEditWebhook = useCallback(async (
    webhookId: number,
    formData: WebhookFormData,
    customHeaders: Array<{ key: string, value: string }>,
    originalWebhookData: WebhookData | null
  ) => {
    if (!hasPermission('webhooks.edit')) {
      toast.error("You don't have permission to edit webhooks");
      return false;
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

      const filteredData = filterMaskedValues(webhookData, originalWebhookData ? originalWebhookData as unknown as Partial<Record<string, unknown>> : undefined);

      await webhookAPI.updateWebhook(webhookId, filteredData);
      toast.success('Webhook updated successfully');
      await loadData(false);
      return true;
    } catch (err: unknown) {
      let errorMessage = 'Error updating webhook';
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      toast.error(errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [hasPermission, loadData]);

  const handleDeleteWebhook = useCallback(async (webhookId: number) => {
    if (!hasPermission('webhooks.delete')) {
      toast.error("You don't have permission to delete webhooks");
      return false;
    }

    try {
      await webhookAPI.deleteWebhook(webhookId);
      toast.success('Webhook deleted successfully');
      await loadData(false);
      return true;
    } catch (err: unknown) {
      let errorMessage = 'Error deleting webhook';
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      toast.error(errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [hasPermission, loadData]);

  const handleTestWebhook = useCallback(async (webhookId: number) => {
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
    } catch (err: unknown) {
      let errorMessage = 'Error testing webhook';
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
      toast.error(errorMessage);
    }
  }, [hasPermission]);

  const handleToggleStatus = useCallback(async (webhook: WebhookData) => {
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
        .catch(() => { });
    } catch (err: unknown) {
      let errorMessage = 'Error updating webhook status';
      if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const errorData = err.response.data as { error?: string }
        errorMessage = errorData.error || errorMessage
      } else {
        errorMessage = getErrorMessage(err)
      }
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
  }, [hasPermission, stats]);

  const handleRefresh = useCallback(async () => {
    await loadData(false);
  }, [loadData]);

  return {
    webhooks,
    stats,
    loading,
    refreshing,
    error,
    loadData,
    handleCreateWebhook,
    handleEditWebhook,
    handleDeleteWebhook,
    handleTestWebhook,
    handleToggleStatus,
    handleRefresh,
  };
}


