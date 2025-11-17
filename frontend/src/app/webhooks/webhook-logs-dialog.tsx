import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import type { WebhookData, WebhookLog } from './types';
import { webhookAPI } from '@/entities/webhook';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { handleError } from '@/lib/error-handler';

interface WebhookLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: WebhookData | null;
}

export function WebhookLogsDialog({
  open,
  onOpenChange,
  webhook
}: WebhookLogsDialogProps) {
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Load webhook logs when dialog opens
  useEffect(() => {
    if (open && webhook) {
      loadWebhookLogs();
    }
  }, [open, webhook]);

  const loadWebhookLogs = async () => {
    if (!webhook) return;
    
    setLoading(true);
    try {
      const logs = await webhookAPI.getWebhookLogs(webhook.id);
      setWebhookLogs(logs);
    } catch (err: any) {
      await handleError(err, {
        category: 'client',
        userMessage: 'Failed to load webhook logs',
        metadata: { webhookId: webhook.id, action: 'load_webhook_logs' }
      });
      setWebhookLogs([]);
    } finally {
      setLoading(false);
    }
  };
  return (
    <ConditionalRender permission="webhooks.view_logs" fallback={null}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Webhook Logs</DialogTitle>
            <DialogDescription>
              Execution logs for {webhook?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" message="Loading webhook logs..." />
            </div>
          ) : !webhookLogs || webhookLogs.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No logs yet</h3>
              <p className="text-muted-foreground">
                This webhook hasn't been triggered yet
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhookLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.event}</TableCell>
                    <TableCell>
                      <Badge variant={log.success ? 'default' : 'destructive'}>
                        {log.success ? 'Success' : 'Failed'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.response_status && (
                        <Badge variant="outline">{log.response_status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.error_message && (
                        <div className="text-sm text-red-600 max-w-xs truncate" title={log.error_message}>
                          {log.error_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={loadWebhookLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </ConditionalRender>
  );
}
