import { useState, useCallback, useEffect } from 'react';
import { useWebhookPermissions } from '@/contexts/webhook-permissions-context';
import { webhookAPI } from '@/entities/webhook';
import { toast } from 'sonner';
import { getErrorMessage, isAxiosError } from '@/lib/error-utils';
import { filterMaskedValues } from '@/lib/webhook-utils';
import type { WebhookData, WebhookFormData, WebhookStats } from '../types';

export function useWebhookActions() {
  const webhookPermissions = useWebhookPermissions();

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
    if (!webhookPermissions.canCreate) {
      toast.error("You don't have permission to create webhooks");
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

      await webhookAPI.createWebhook(webhookData);
      toast.success('Webhook created successfully');
      await loadData(false);
      return true;
    } catch (err: unknown) {
      let errorMessage = 'Error creating webhook';
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
  }, [webhookPermissions.canCreate, loadData]);

  const handleEditWebhook = useCallback(async (
    webhookId: number,
    formData: WebhookFormData,
    customHeaders: Array<{ key: string, value: string }>,
    originalWebhookData: WebhookData | null
  ) => {
    if (!webhookPermissions.canEdit) {
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
  }, [webhookPermissions.canEdit, loadData]);

  const handleDeleteWebhook = useCallback(async (webhookId: number) => {
    if (!webhookPermissions.canDelete) {
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
  }, [webhookPermissions.canDelete, loadData]);

  const handleTestWebhook = useCallback(async (webhookId: number) => {
    if (!webhookPermissions.canTest) {
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
  }, [webhookPermissions.canTest]);

  const handleToggleStatus = useCallback(async (webhook: WebhookData) => {
    if (!webhookPermissions.canEdit) {
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
  }, [webhookPermissions.canEdit, stats]);

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


