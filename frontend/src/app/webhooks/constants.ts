import type { WebhookEvent } from './types';

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  // Key events
  { name: 'key.created', description: 'Key created', category: 'keys' },
  { name: 'key.activated', description: 'Key activated', category: 'keys' },
  { name: 'key.expired', description: 'Key expired', category: 'keys' },
  { name: 'key.blocked', description: 'Key blocked', category: 'keys' },

  // User events
  { name: 'user.created', description: 'User created', category: 'users' },
  { name: 'user.login', description: 'User login', category: 'users' },
  { name: 'user.logout', description: 'User logout', category: 'users' },

  // Game events
  { name: 'game.created', description: 'Game created', category: 'games' },
  { name: 'game.updated', description: 'Game updated', category: 'games' },
  { name: 'game.activated', description: 'Game activated', category: 'games' },
  { name: 'game.deactivated', description: 'Game deactivated', category: 'games' },

  // Security events
  { name: 'security.alert', description: 'Security alert', category: 'security' },
  { name: 'security.block', description: 'Security block', category: 'security' },

  // System events
  { name: 'system.maintenance', description: 'System maintenance', category: 'system' },
  { name: 'system.error', description: 'System error', category: 'system' },
];
