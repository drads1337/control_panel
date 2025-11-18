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
import type { WebhookFormData, SecretsVisibility } from './types';
import { WEBHOOK_EVENTS } from './constants';

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
    <div className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
      <div>
        <Label htmlFor={`${prefix}name`}>Name</Label>
        <Input
          id={`${prefix}name`}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="My Webhook"
        />
      </div>

      <div>
        <Label htmlFor={`${prefix}webhook_type`}>Type</Label>
        <Select
          value={formData.webhook_type}
          onValueChange={(value: 'telegram' | 'discord' | 'custom') =>
            setFormData({ ...formData, webhook_type: value })
          }
        >
          <SelectTrigger id={`${prefix}webhook_type`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="telegram">Telegram</SelectItem>
            <SelectItem value="discord">Discord</SelectItem>
            <SelectItem value="custom">Custom URL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.webhook_type === 'telegram' && (
        <>
          <div>
            <Label htmlFor={`${prefix}telegram_bot_token`}>Bot Token</Label>
            <div className="flex gap-2">
              <Input
                id={`${prefix}telegram_bot_token`}
                type={secretsVisibility[isEdit ? 'editTelegramToken' : 'createTelegramToken'] ? 'text' : 'password'}
                value={formData.telegram_bot_token}
                onChange={(e) => setFormData({ ...formData, telegram_bot_token: e.target.value })}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSecretsVisibility(prev => ({ 
                  ...prev, 
                  [isEdit ? 'editTelegramToken' : 'createTelegramToken']: !prev[isEdit ? 'editTelegramToken' : 'createTelegramToken']
                }))}
              >
                {secretsVisibility[isEdit ? 'editTelegramToken' : 'createTelegramToken'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor={`${prefix}telegram_chat_id`}>Chat ID or Username</Label>
            <Input
              id={`${prefix}telegram_chat_id`}
              value={formData.telegram_chat_id}
              onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
              placeholder="@username or -1001234567890"
            />
            <p className="text-sm text-muted-foreground mt-1">
              You can specify @username or Chat ID of group/channel
            </p>
          </div>
        </>
      )}

      {formData.webhook_type === 'discord' && (
        <>
          <div>
            <Label htmlFor={`${prefix}discord_webhook_url`}>Webhook URL (Optional)</Label>
            <Input
              id={`${prefix}discord_webhook_url`}
              value={formData.discord_webhook_url}
              onChange={(e) => setFormData({ ...formData, discord_webhook_url: e.target.value })}
              placeholder="https://discord.com/api/webhooks/..."
            />
          </div>

          <div className="text-sm text-muted-foreground">
            OR use Bot Token + Channel ID:
          </div>

          <div>
            <Label htmlFor={`${prefix}discord_bot_token`}>Bot Token</Label>
            <div className="flex gap-2">
              <Input
                id={`${prefix}discord_bot_token`}
                type={secretsVisibility[isEdit ? 'editDiscordToken' : 'createDiscordToken'] ? 'text' : 'password'}
                value={formData.discord_bot_token}
                onChange={(e) => setFormData({ ...formData, discord_bot_token: e.target.value })}
                placeholder="MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GhIjKl.MnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWx"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSecretsVisibility(prev => ({ 
                  ...prev, 
                  [isEdit ? 'editDiscordToken' : 'createDiscordToken']: !prev[isEdit ? 'editDiscordToken' : 'createDiscordToken']
                }))}
              >
                {secretsVisibility[isEdit ? 'editDiscordToken' : 'createDiscordToken'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor={`${prefix}discord_channel_id`}>Channel ID</Label>
            <Input
              id={`${prefix}discord_channel_id`}
              value={formData.discord_channel_id}
              onChange={(e) => setFormData({ ...formData, discord_channel_id: e.target.value })}
              placeholder="1234567890123456789"
            />
          </div>
        </>
      )}

      {formData.webhook_type === 'custom' && (
        <div>
          <Label htmlFor={`${prefix}url`}>URL</Label>
          <Input
            id={`${prefix}url`}
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://example.com/webhook"
          />
        </div>
      )}

      <div>
        <Label htmlFor={`${prefix}secret`}>Secret (Optional)</Label>
        <div className="flex gap-2">
          <Input
            id={`${prefix}secret`}
            type={secretsVisibility[isEdit ? 'editSecret' : 'createSecret'] ? 'text' : 'password'}
            value={formData.secret}
            onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
            placeholder="Webhook secret for signing"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSecretsVisibility(prev => ({ 
              ...prev, 
              [isEdit ? 'editSecret' : 'createSecret']: !prev[isEdit ? 'editSecret' : 'createSecret']
            }))}
          >
            {secretsVisibility[isEdit ? 'editSecret' : 'createSecret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div>
        <Label>Events</Label>
        <div className="space-y-3 max-h-60 overflow-y-auto border rounded-md p-3">
          {Object.entries(eventsByCategory).map(([category, events]) => (
            <div key={category}>
              <h4 className="font-medium text-sm mb-2 capitalize">{category}</h4>
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.name} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${prefix}${event.name}`}
                      checked={formData.events.includes(event.name)}
                      onCheckedChange={() => toggleEvent(event.name)}
                    />
                    <Label htmlFor={`${prefix}${event.name}`} className="text-sm font-normal">
                      {event.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Custom Headers</Label>
        <div className="space-y-2">
          {customHeaders.map((header, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Header name"
                value={header.key}
                onChange={(e) => updateCustomHeader(index, 'key', e.target.value)}
              />
              <Input
                placeholder="Header value"
                value={header.value}
                onChange={(e) => updateCustomHeader(index, 'value', e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeCustomHeader(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addCustomHeader}>
            <Plus className="h-4 w-4 mr-2" />
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
        <Label htmlFor={`${prefix}is_active`}>Active</Label>
      </div>
    </div>
  );
}
