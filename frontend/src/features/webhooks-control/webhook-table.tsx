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
  Clock,
  RefreshCw
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
import { ConditionalRender } from '@/lib/rbac/conditional-render';
import { usePermissions } from '@/lib/hooks';

interface WebhookTableProps {
  webhooks: WebhookData[];
  onCreateClick: () => void;
  onEditClick: (webhook: WebhookData) => void;
  onDeleteClick: (webhookId: number) => void;
  onTestClick: (webhookId: number) => void;
  onToggleStatus: (webhook: WebhookData) => void;
  onLogsClick: (webhook: WebhookData) => void;
  onCopyToClipboard: (text: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function WebhookTable({
  webhooks,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onTestClick,
  onToggleStatus,
  onLogsClick,
  onCopyToClipboard,
  onRefresh,
  refreshing = false
}: WebhookTableProps) {
  const { hasPermission } = usePermissions();

  // Вспомогательная функция для рендера цели (Target) чтобы не дублировать логику
  const renderTarget = (webhook: WebhookData) => {
    if (webhook.webhook_type === 'telegram') {
      return (
        <div className="flex items-center gap-2 max-w-full">
          <span className="truncate text-xs sm:text-sm">
            {webhook.telegram_chat_id?.startsWith('@') ?
              `User: ${webhook.telegram_chat_id}` :
              `Chat: ${webhook.telegram_chat_id}`
            }
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onCopyToClipboard(webhook.telegram_chat_id || '')}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    if (webhook.webhook_type === 'discord') {
      return (
        <div className="flex items-center gap-2 max-w-full">
          <span className="truncate text-xs sm:text-sm">
            {webhook.discord_webhook_url ? 'Webhook URL' : `Channel: ${webhook.discord_channel_id}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onCopyToClipboard(webhook.discord_webhook_url || webhook.discord_channel_id || '')}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    if (webhook.webhook_type === 'custom') {
      return (
        <div className="flex items-center gap-2 max-w-full">
          <span className="truncate text-xs sm:text-sm">{webhook.url}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onCopyToClipboard(webhook.url || '')}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-0 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <CardTitle className="text-base">Webhooks</CardTitle>
            <CardDescription className="mt-1 text-xs">
              {webhooks.length || 0} total
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <ConditionalRender permission="webhooks.create" fallback={null}>
              <Button
                variant="default"
                size="sm"
                onClick={onCreateClick}
                className="hidden sm:flex"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create Webhook
              </Button>
            </ConditionalRender>
          </div>
        </div>
        <ConditionalRender permission="webhooks.create" fallback={null}>
          <Button
            variant="default"
            size="icon"
            onClick={onCreateClick}
            className="sm:hidden absolute top-4 right-4"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </ConditionalRender>
      </CardHeader>
      <CardContent className="pt-0 sm:-mt-3">
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
          <>
            {/* --- MOBILE VIEW (Card List) --- */}
            <div className="space-y-4 sm:hidden mt-4">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="border rounded-lg p-4 space-y-4 bg-card text-card-foreground shadow-sm">
                  {/* Header: Name & Switch */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{webhook.name}</div>
                      <div className="mt-1">
                         <Badge variant="outline" className="capitalize text-[10px] px-1.5 h-5">
                          {webhook.webhook_type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ConditionalRender permission="webhooks.edit" fallback={
                          <Badge variant={webhook.is_active ? 'default' : 'secondary'} className="text-[10px]">
                            {webhook.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        }>
                          <Switch
                            checked={webhook.is_active}
                            onCheckedChange={() => onToggleStatus(webhook)}
                            className="scale-75 origin-right" 
                          />
                        </ConditionalRender>
                    </div>
                  </div>

                  {/* Body: Target & Events */}
                  <div className="space-y-2 text-sm">
                    <div className="bg-muted/30 p-2 rounded text-muted-foreground">
                      {renderTarget(webhook)}
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.slice(0, 3).map((event) => (
                        <Badge key={event} variant="secondary" className="text-[10px] px-1.5">
                          {event}
                        </Badge>
                      ))}
                      {webhook.events.length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5">
                          +{webhook.events.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Footer: Stats & Actions */}
                  <div className="pt-3 border-t flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                       <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                            {webhook.success_count}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            {webhook.failure_count}
                          </span>
                       </div>
                       <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {webhook.last_triggered ? new Date(webhook.last_triggered).toLocaleDateString() : 'Never'}
                       </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        <ConditionalRender permission="webhooks.view_logs" fallback={<div/>}>
                          <Button variant="outline" size="sm" onClick={() => onLogsClick(webhook)} className="w-full h-8 px-0">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </ConditionalRender>
                        <ConditionalRender permission="webhooks.test" fallback={<div/>}>
                          <Button variant="outline" size="sm" onClick={() => onTestClick(webhook.id)} className="w-full h-8 px-0">
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        </ConditionalRender>
                        <ConditionalRender permission="webhooks.edit" fallback={<div/>}>
                          <Button variant="outline" size="sm" onClick={() => onEditClick(webhook)} className="w-full h-8 px-0">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </ConditionalRender>
                        <ConditionalRender permission="webhooks.delete" fallback={<div/>}>
                          <Button variant="outline" size="sm" onClick={() => onDeleteClick(webhook.id)} className="w-full h-8 px-0 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </ConditionalRender>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden sm:block rounded-md border overflow-x-auto">
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
                         {renderTarget(webhook)}
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
                            />
                            <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                              {webhook.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </ConditionalRender>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                            {webhook.success_count}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            {webhook.failure_count}
                          </span>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}