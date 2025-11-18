export interface WebhookData {
  id: number;
  name: string;
  webhook_type: 'telegram' | 'discord' | 'custom';
  url?: string;
  events: string[];
  secret?: string;
  is_active: boolean;
  headers?: Record<string, string>;

  telegram_bot_token?: string;
  telegram_chat_id?: string;

  discord_webhook_url?: string;
  discord_bot_token?: string;
  discord_channel_id?: string;
  success_count: number;
  failure_count: number;
  last_triggered?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: number;
  event: string;
  success: boolean;
  error_message?: string;
  response_status?: number;
  created_at: string;
}

export interface WebhookEvent {
  name: string;
  description: string;
  category: string;
}

export interface WebhookFormData {
  name: string;
  webhook_type: 'telegram' | 'discord' | 'custom';
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  headers: Record<string, string>;

  telegram_bot_token: string;
  telegram_chat_id: string;

  discord_webhook_url: string;
  discord_bot_token: string;
  discord_channel_id: string;
}

export interface WebhookStats {
  total_webhooks: number;
  active_webhooks: number;
  total_success: number;
  total_failures: number;
  success_rate: number;
  recent_success: number;
  recent_failures: number;
  recent_success_rate: number;
}

export interface SecretsVisibility {
  createTelegramToken: boolean;
  createDiscordToken: boolean;
  createSecret: boolean;
  editTelegramToken: boolean;
  editDiscordToken: boolean;
  editSecret: boolean;
}
