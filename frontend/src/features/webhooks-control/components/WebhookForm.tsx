import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import type { WebhookFormData, SecretsVisibility } from '../types';
import { WEBHOOK_EVENTS } from '../constants';

interface WebhookFormProps {
  formData: WebhookFormData;
  setFormData: React.Dispatch<React.SetStateAction<WebhookFormData>>;
  secretsVisibility: SecretsVisibility;
  setSecretsVisibility: React.Dispatch<React.SetStateAction<SecretsVisibility>>;
  customHeaders: Array<{ key: string, value: string }>;
  setCustomHeaders: React.Dispatch<React.SetStateAction<Array<{ key: string, value: string }>>>;
  isEdit?: boolean;
}

export function WebhookForm({
  formData,
  setFormData,
  secretsVisibility,
  setSecretsVisibility,
  customHeaders,
  setCustomHeaders,
  isEdit = false
}: WebhookFormProps) {

  const eventsByCategory = WEBHOOK_EVENTS.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, typeof WEBHOOK_EVENTS>);

  const toggleEvent = (eventName: string) => {
    const updated = formData.events.includes(eventName)
      ? formData.events.filter(e => e !== eventName)
      : [...formData.events, eventName];
    setFormData({ ...formData, events: updated });
  };

  const addCustomHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const removeCustomHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  const updateCustomHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

  const prefix = isEdit ? 'edit-' : '';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}name`} className="text-xs font-medium">Name</Label>
        <Input
          id={`${prefix}name`}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="My Webhook"
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}webhook_type`} className="text-xs font-medium">Type</Label>
        <Select
          value={formData.webhook_type}
          onValueChange={(value: 'telegram' | 'discord' | 'custom') =>
            setFormData({ ...formData, webhook_type: value })
          }
        >
          <SelectTrigger id={`${prefix}webhook_type`} className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="text-xs">
            <SelectItem value="telegram">Telegram</SelectItem>
            <SelectItem value="discord">Discord</SelectItem>
            <SelectItem value="custom">Custom URL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.webhook_type === 'telegram' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}telegram_bot_token`} className="text-xs font-medium">Bot Token</Label>
            <div className="flex gap-2">
              <Input
                id={`${prefix}telegram_bot_token`}
                type={secretsVisibility[isEdit ? 'editTelegramToken' : 'createTelegramToken'] ? 'text' : 'password'}
                value={formData.telegram_bot_token}
                onChange={(e) => setFormData({ ...formData, telegram_bot_token: e.target.value })}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="flex-1 h-8 text-xs"
              />
              <Button
                variant="outline"
                className="h-8 text-xs shrink-0"
                onClick={() => setSecretsVisibility(prev => ({ 
                  ...prev, 
                  [isEdit ? 'editTelegramToken' : 'createTelegramToken']: !prev[isEdit ? 'editTelegramToken' : 'createTelegramToken']
                }))}
              >
                {secretsVisibility[isEdit ? 'editTelegramToken' : 'createTelegramToken'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}telegram_chat_id`} className="text-xs font-medium">Chat ID or Username</Label>
            <Input
              id={`${prefix}telegram_chat_id`}
              value={formData.telegram_chat_id}
              onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
              placeholder="@username or -1001234567890"
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              You can specify @username or Chat ID of group/channel
            </p>
          </div>
        </>
      )}

      {formData.webhook_type === 'discord' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}discord_webhook_url`} className="text-xs font-medium">Webhook URL (Optional)</Label>
            <Input
              id={`${prefix}discord_webhook_url`}
              value={formData.discord_webhook_url}
              onChange={(e) => setFormData({ ...formData, discord_webhook_url: e.target.value })}
              placeholder="https://discord.com/api/webhooks/..."
              className="h-8 text-xs"
            />
          </div>

          <div className="text-[10px] text-muted-foreground">
            OR use Bot Token + Channel ID:
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}discord_bot_token`} className="text-xs font-medium">Bot Token</Label>
            <div className="flex gap-2">
              <Input
                id={`${prefix}discord_bot_token`}
                type={secretsVisibility[isEdit ? 'editDiscordToken' : 'createDiscordToken'] ? 'text' : 'password'}
                value={formData.discord_bot_token}
                onChange={(e) => setFormData({ ...formData, discord_bot_token: e.target.value })}
                placeholder="MTIzNDU2Nzg5MDEyMzQ1Njc4OQ..."
                className="flex-1 h-8 text-xs"
              />
              <Button
                variant="outline"
                className="h-8 text-xs shrink-0"
                onClick={() => setSecretsVisibility(prev => ({ 
                  ...prev, 
                  [isEdit ? 'editDiscordToken' : 'createDiscordToken']: !prev[isEdit ? 'editDiscordToken' : 'createDiscordToken']
                }))}
              >
                {secretsVisibility[isEdit ? 'editDiscordToken' : 'createDiscordToken'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}discord_channel_id`} className="text-xs font-medium">Channel ID</Label>
            <Input
              id={`${prefix}discord_channel_id`}
              value={formData.discord_channel_id}
              onChange={(e) => setFormData({ ...formData, discord_channel_id: e.target.value })}
              placeholder="1234567890123456789"
              className="h-8 text-xs"
            />
          </div>
        </>
      )}

      {formData.webhook_type === 'custom' && (
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}url`} className="text-xs font-medium">URL</Label>
          <Input
            id={`${prefix}url`}
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://example.com/webhook"
            className="h-8 text-xs"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}secret`} className="text-xs font-medium">Secret (Optional)</Label>
        <div className="flex gap-2">
          <Input
            id={`${prefix}secret`}
            type={secretsVisibility[isEdit ? 'editSecret' : 'createSecret'] ? 'text' : 'password'}
            value={formData.secret}
            onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
            placeholder="Webhook secret for signing"
            className="flex-1 h-8 text-xs"
          />
          <Button
            variant="outline"
            className="h-8 text-xs shrink-0"
            onClick={() => setSecretsVisibility(prev => ({ 
              ...prev, 
              [isEdit ? 'editSecret' : 'createSecret']: !prev[isEdit ? 'editSecret' : 'createSecret']
            }))}
          >
            {secretsVisibility[isEdit ? 'editSecret' : 'createSecret'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Events</Label>
        <div className="space-y-3 max-h-60 overflow-y-auto border rounded-md p-3 bg-muted/10">
          {Object.entries(eventsByCategory).map(([category, events]) => (
            <div key={category}>
              <h4 className="font-medium text-xs mb-2 capitalize">{category}</h4>
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.name} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${prefix}${event.name}`}
                      checked={formData.events.includes(event.name)}
                      onCheckedChange={() => toggleEvent(event.name)}
                    />
                    <Label htmlFor={`${prefix}${event.name}`} className="text-xs font-normal cursor-pointer">
                      {event.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Custom Headers</Label>
        <div className="space-y-3">
          {customHeaders.map((header, index) => (
            <div key={index} className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Header name"
                value={header.key}
                onChange={(e) => updateCustomHeader(index, 'key', e.target.value)}
                className="w-full sm:flex-1 h-8 text-xs"
              />
              <Input
                placeholder="Header value"
                value={header.value}
                onChange={(e) => updateCustomHeader(index, 'value', e.target.value)}
                className="w-full sm:flex-1 h-8 text-xs"
              />
              <Button
                variant="outline"
                className="h-8 text-xs w-full sm:w-auto shrink-0"
                onClick={() => removeCustomHeader(index)}
              >
                <Trash2 className="h-3 w-3" />
                <span className="sm:hidden ml-2">Remove Header</span>
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addCustomHeader} className="h-8 text-xs w-full sm:w-auto">
            <Plus className="h-3 w-3 mr-2" />
            Add Header
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id={`${prefix}is_active`}
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor={`${prefix}is_active`} className="text-xs font-medium">Active</Label>
      </div>
    </div>
  );
}

