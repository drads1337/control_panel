import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw, X } from 'lucide-react';
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
import type { WebhookData, WebhookLog } from '../types';
import { webhookAPI } from '@/entities/webhook/api/webhook';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { getErrorMessage } from '@/shared/lib/utils/error-utils';

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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to load webhook logs');
      setWebhookLogs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConditionalRender permission="webhooks.view_logs" fallback={null}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle>Webhook Logs</DialogTitle>
            <DialogDescription>
              Execution logs for {webhook?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="lg" />
                <span className="ml-2">Loading webhook logs...</span>
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
              <>
                <div className="sm:hidden space-y-4">
                  {webhookLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-3 space-y-3 bg-card">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-foreground">{log.event}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={log.success ? 'default' : 'destructive'}>
                          {log.success ? 'Success' : 'Failed'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                         <span className="text-muted-foreground">Status:</span>
                         {log.response_status ? (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">{log.response_status}</Badge>
                         ) : <span>-</span>}
                      </div>

                      {log.error_message && (
                        <div className="bg-destructive/10 p-2 rounded text-xs text-red-600 break-all">
                          <span className="font-semibold block mb-0.5">Error:</span>
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block">
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
                </div>
              </>
            )}
          </div>

          <DialogFooter className="p-6 pt-4 border-t flex flex-row justify-end gap-2 shrink-0">
            <Button 
              variant="ghost" 
              onClick={loadWebhookLogs}
              disabled={loading}
              size="icon"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              size="icon"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConditionalRender>
  );
}

