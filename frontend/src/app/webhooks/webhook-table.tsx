import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Webhook,
  Plus,
  Edit,
  Trash2,
  Play,
  Eye,
  Copy,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WebhookData } from './types';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { usePermissions } from '@/hooks/use-permissions';

interface WebhookTableProps {
  webhooks: WebhookData[];
  onCreateClick: () => void;
  onEditClick: (webhook: WebhookData) => void;
  onDeleteClick: (webhookId: number) => void;
  onTestClick: (webhookId: number) => void;
  onToggleStatus: (webhook: WebhookData) => void;
  onLogsClick: (webhook: WebhookData) => void;
  onCopyToClipboard: (text: string) => void;
}

export function WebhookTable({
  webhooks,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onTestClick,
  onToggleStatus,
  onLogsClick,
  onCopyToClipboard
}: WebhookTableProps) {
  const { hasPermission } = usePermissions();

  const canEdit = hasPermission('webhooks.edit');
  const canToggle = canEdit;
  
  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Webhooks</CardTitle>
            <CardDescription className="mt-1 text-xs">
              {webhooks.length || 0} total
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 -mt-3">
        {webhooks.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Webhook className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <div className="text-sm text-muted-foreground">No webhooks found</div>
              <ConditionalRender permission="webhooks.create" fallback={null}>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onCreateClick}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Webhook
                </Button>
              </ConditionalRender>
            </div>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Statistics</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {webhook.webhook_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {webhook.webhook_type === 'telegram' && (
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-xs">
                            {webhook.telegram_chat_id?.startsWith('@') ?
                              `User: ${webhook.telegram_chat_id}` :
                              `Chat: ${webhook.telegram_chat_id}`
                            }
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCopyToClipboard(webhook.telegram_chat_id || '')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {webhook.webhook_type === 'discord' && (
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-xs">
                            {webhook.discord_webhook_url ? 'Webhook URL' : `Channel: ${webhook.discord_channel_id}`}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCopyToClipboard(webhook.discord_webhook_url || webhook.discord_channel_id || '')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {webhook.webhook_type === 'custom' && (
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-xs">{webhook.url}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCopyToClipboard(webhook.url || '')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.slice(0, 2).map((event) => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                        {webhook.events.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{webhook.events.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ConditionalRender permission="webhooks.edit" fallback={
                          <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                            {webhook.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        }>
                          <Switch
                            checked={webhook.is_active}
                            onCheckedChange={() => onToggleStatus(webhook)}
                            disabled={!canToggle}
                          />
                          <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                            {webhook.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </ConditionalRender>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          {webhook.success_count}
                        </div>
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-3 w-3" />
                          {webhook.failure_count}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.last_triggered ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(webhook.last_triggered).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ConditionalRender permission="webhooks.view_logs" fallback={null}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onLogsClick(webhook)}
                            aria-label={`View logs for webhook ${webhook.name || webhook.id}`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </ConditionalRender>
                        <ConditionalRender permission="webhooks.test" fallback={null}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onTestClick(webhook.id)}
                            aria-label={`Test webhook ${webhook.name || webhook.id}`}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        </ConditionalRender>
                        <ConditionalRender permission="webhooks.edit" fallback={null}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditClick(webhook)}
                            aria-label={`Edit webhook ${webhook.name || webhook.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </ConditionalRender>
                        <ConditionalRender permission="webhooks.delete" fallback={null}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteClick(webhook.id)}
                            aria-label={`Delete webhook ${webhook.name || webhook.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </ConditionalRender>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
