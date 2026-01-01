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
import type { WebhookData } from '../types';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { usePermissions } from '@/shared/hooks/use-permissions';

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
          <span className="truncate text-xs">
            {webhook.telegram_chat_id?.startsWith('@') ?
              `User: ${webhook.telegram_chat_id}` :
              `Chat: ${webhook.telegram_chat_id}`
            }
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onCopyToClipboard(webhook.telegram_chat_id || '')}
          >
            <Copy className="size-3" />
          </Button>
        </div>
      );
    }
    if (webhook.webhook_type === 'discord') {
      return (
        <div className="flex items-center gap-2 max-w-full">
          <span className="truncate text-xs">
            {webhook.discord_webhook_url ? 'Webhook URL' : `Channel: ${webhook.discord_channel_id}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onCopyToClipboard(webhook.discord_webhook_url || webhook.discord_channel_id || '')}
          >
            <Copy className="size-3" />
          </Button>
        </div>
      );
    }
    if (webhook.webhook_type === 'custom') {
      return (
        <div className="flex items-center gap-2 max-w-full">
          <span className="truncate text-xs">{webhook.url}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onCopyToClipboard(webhook.url || '')}
          >
            <Copy className="size-3" />
          </Button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="px-4 lg:px-6">
      <Card className="p-3 border rounded-lg bg-background shadow-sm">
        <CardHeader className="p-0 pb-1 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
          <div>
            <CardTitle className="text-xl font-semibold">Webhooks</CardTitle>
            <CardDescription className="text-xs">
              {webhooks.length || 0} total
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={refreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <ConditionalRender permission="webhooks.create" fallback={null}>
              <Button
                variant="default"
                size="sm"
                onClick={onCreateClick}
                className="hidden sm:flex h-8 text-xs gap-1.5"
              >
                <Plus className="size-3" />
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
            className="sm:hidden absolute top-0 right-0 h-8 w-8"
          >
            <Plus className="size-3" />
          </Button>
        </ConditionalRender>
      </CardHeader>
      <CardContent className="p-0 pt-1">
        {webhooks.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Webhook className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-xs text-muted-foreground">No webhooks found</div>
              <ConditionalRender permission="webhooks.create" fallback={null}>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onCreateClick}
                  className="mt-3 h-8 text-xs gap-1.5"
                >
                  <Plus className="size-3" />
                  Create First Webhook
                </Button>
              </ConditionalRender>
            </div>
          </div>
        ) : (
          <>
            {/* --- MOBILE VIEW (Card List) --- */}
            <div className="space-y-3 sm:hidden mt-3">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="border border-muted-foreground/10 rounded-md p-2 space-y-2 bg-muted/10 shadow-sm">
                  {/* Header: Name & Switch */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-xs">{webhook.name}</div>
                      <div className="mt-1">
                         <Badge variant="outline" className="capitalize text-[10px] px-1.5 h-5">
                          {webhook.webhook_type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <ConditionalRender permission="webhooks.edit" fallback={
                          <Badge variant={webhook.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5 h-5">
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
                  <div className="space-y-1.5 text-xs">
                    <div className="bg-muted/30 p-1.5 rounded-md border border-muted-foreground/10 text-muted-foreground">
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
                  <div className="pt-2 border-t border-muted-foreground/10 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                       <div className="flex gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                            {webhook.success_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            {webhook.failure_count}
                          </span>
                       </div>
                       <div className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {webhook.last_triggered ? new Date(webhook.last_triggered).toLocaleDateString() : 'Never'}
                       </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                        <ConditionalRender permission="webhooks.view_logs" fallback={<div/>}>
                          <Button variant="outline" size="sm" onClick={() => onLogsClick(webhook)} className="w-full h-8 px-0 hover:bg-muted/50">
                            <Eye className="size-3" />
                          </Button>
                        </ConditionalRender>
                        <ConditionalRender permission="webhooks.test" fallback={<div/>}>
                          <Button variant="outline" size="sm" onClick={() => onTestClick(webhook.id)} className="w-full h-8 px-0 hover:bg-muted/50">
                            <Play className="size-3" />
                          </Button>
                        </ConditionalRender>
                        <ConditionalRender permission="webhooks.edit" fallback={<div/>}>
                          <Button variant="outline" size="sm" onClick={() => onEditClick(webhook)} className="w-full h-8 px-0 hover:bg-muted/50">
                            <Edit className="size-3" />
                          </Button>
                        </ConditionalRender>
                        <ConditionalRender permission="webhooks.delete" fallback={<div/>}>
                          <Button variant="outline" size="sm" onClick={() => onDeleteClick(webhook.id)} className="w-full h-8 px-0 text-destructive hover:text-destructive hover:bg-muted/50">
                            <Trash2 className="size-3" />
                          </Button>
                        </ConditionalRender>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden sm:block rounded-md border border-muted-foreground/10 overflow-x-auto bg-muted/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Name</TableHead>
                    <TableHead className="text-xs h-8">Type</TableHead>
                    <TableHead className="text-xs h-8">Target</TableHead>
                    <TableHead className="text-xs h-8">Events</TableHead>
                    <TableHead className="text-xs h-8">Status</TableHead>
                    <TableHead className="text-xs h-8">Statistics</TableHead>
                    <TableHead className="text-xs h-8">Last Triggered</TableHead>
                    <TableHead className="text-xs h-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-xs py-2">{webhook.name}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="capitalize text-[10px] px-1.5">
                          {webhook.webhook_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                         {renderTarget(webhook)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.slice(0, 2).map((event) => (
                            <Badge key={event} variant="secondary" className="text-[10px] px-1.5">
                              {event}
                            </Badge>
                          ))}
                          {webhook.events.length > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1.5">
                              +{webhook.events.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1">
                          <ConditionalRender permission="webhooks.edit" fallback={
                            <Badge variant={webhook.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                              {webhook.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          }>
                            <Switch
                              checked={webhook.is_active}
                              onCheckedChange={() => onToggleStatus(webhook)}
                              className="scale-90"
                            />
                            <Badge variant={webhook.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                              {webhook.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </ConditionalRender>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                            {webhook.success_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            {webhook.failure_count}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        {webhook.last_triggered ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3" />
                            {new Date(webhook.last_triggered).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1">
                          <ConditionalRender permission="webhooks.view_logs" fallback={null}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onLogsClick(webhook)}
                              aria-label={`View logs for webhook ${webhook.name || webhook.id}`}
                              className="h-8 w-8 hover:bg-muted/50"
                            >
                              <Eye className="size-3" />
                            </Button>
                          </ConditionalRender>
                          <ConditionalRender permission="webhooks.test" fallback={null}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onTestClick(webhook.id)}
                              aria-label={`Test webhook ${webhook.name || webhook.id}`}
                              className="h-8 w-8 hover:bg-muted/50"
                            >
                              <Play className="size-3" />
                            </Button>
                          </ConditionalRender>
                          <ConditionalRender permission="webhooks.edit" fallback={null}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditClick(webhook)}
                              aria-label={`Edit webhook ${webhook.name || webhook.id}`}
                              className="h-8 w-8 hover:bg-muted/50"
                            >
                              <Edit className="size-3" />
                            </Button>
                          </ConditionalRender>
                          <ConditionalRender permission="webhooks.delete" fallback={null}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteClick(webhook.id)}
                              aria-label={`Delete webhook ${webhook.name || webhook.id}`}
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-muted/50"
                            >
                              <Trash2 className="size-3" />
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
    </div>
  );
}

