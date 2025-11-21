import type { WebhookEvent } from './types';

export const WEBHOOK_EVENTS: WebhookEvent[] = [

  { name: 'key.created', description: 'Key created', category: 'keys' },
  { name: 'key.activated', description: 'Key activated', category: 'keys' },
  { name: 'key.expired', description: 'Key expired', category: 'keys' },
  { name: 'key.blocked', description: 'Key blocked', category: 'keys' },

  { name: 'user.created', description: 'User created', category: 'users' },
  { name: 'user.login', description: 'User login', category: 'users' },
  { name: 'user.logout', description: 'User logout', category: 'users' },

  { name: 'product.created', description: 'Product created', category: 'products' },
  { name: 'product.updated', description: 'Product updated', category: 'products' },
  { name: 'product.activated', description: 'Product activated', category: 'products' },
  { name: 'product.deactivated', description: 'Product deactivated', category: 'products' },

  { name: 'security.alert', description: 'Security alert', category: 'security' },
  { name: 'security.block', description: 'Security block', category: 'security' },

  { name: 'system.maintenance', description: 'System maintenance', category: 'system' },
  { name: 'system.error', description: 'System error', category: 'system' },
];
