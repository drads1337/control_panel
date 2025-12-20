import type { WebhookEvent } from './types';

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  // Keys
  { name: 'key.created', description: 'Key created', category: 'keys' },
  { name: 'key.activated', description: 'Key activated', category: 'keys' },
  { name: 'key.expired', description: 'Key expired', category: 'keys' },
  { name: 'key.blocked', description: 'Key blocked', category: 'keys' },
  { name: 'key.unblocked', description: 'Key unblocked', category: 'keys' },
  { name: 'key.deleted', description: 'Key deleted', category: 'keys' },
  { name: 'key.updated', description: 'Key updated', category: 'keys' },
  { name: 'key.used', description: 'Key used', category: 'keys' },
  { name: 'key.renewed', description: 'Key renewed', category: 'keys' },
  { name: 'key.suspended', description: 'Key suspended', category: 'keys' },
  { name: 'key.unsuspended', description: 'Key unsuspended', category: 'keys' },

  // Connect
  { name: 'connect.success', description: 'Client connected successfully', category: 'connect' },
  { name: 'connect.failed', description: 'Connection failed', category: 'connect' },
  { name: 'connect.disconnected', description: 'Client disconnected', category: 'connect' },
  { name: 'connect.challenge_requested', description: 'Challenge requested', category: 'connect' },
  { name: 'connect.token_generated', description: 'Token generated', category: 'connect' },
  { name: 'connect.token_expired', description: 'Token expired', category: 'connect' },

  // Users
  { name: 'user.created', description: 'User created', category: 'users' },
  { name: 'user.registered', description: 'User registered', category: 'users' },
  { name: 'user.login', description: 'User login', category: 'users' },
  { name: 'user.logout', description: 'User logout', category: 'users' },
  { name: 'user.password_changed', description: 'Password changed', category: 'users' },
  { name: 'user.role_changed', description: 'User role changed', category: 'users' },
  { name: 'user.deleted', description: 'User deleted', category: 'users' },
  { name: 'user.updated', description: 'User updated', category: 'users' },
  { name: 'user.suspended', description: 'User suspended', category: 'users' },
  { name: 'user.activated', description: 'User activated', category: 'users' },
  { name: 'user.email_changed', description: 'Email changed', category: 'users' },
  { name: 'user.profile_updated', description: 'Profile updated', category: 'users' },
  { name: 'user.2fa_enabled', description: '2FA enabled', category: 'users' },
  { name: 'user.2fa_disabled', description: '2FA disabled', category: 'users' },

  // Products
  { name: 'product.created', description: 'Product created', category: 'products' },
  { name: 'product.updated', description: 'Product updated', category: 'products' },
  { name: 'product.activated', description: 'Product activated', category: 'products' },
  { name: 'product.deactivated', description: 'Product deactivated', category: 'products' },
  { name: 'product.deleted', description: 'Product deleted', category: 'products' },
  { name: 'product.file_uploaded', description: 'File uploaded', category: 'products' },
  { name: 'product.file_downloaded', description: 'File downloaded', category: 'products' },
  { name: 'product.settings_changed', description: 'Settings changed', category: 'products' },
  { name: 'product.version_updated', description: 'Version updated', category: 'products' },
  // Security
  { name: 'security.alert', description: 'Security alert', category: 'security' },
  { name: 'security.block', description: 'Security block', category: 'security' },
  { name: 'security.login_failed', description: 'Login failed', category: 'security' },
  { name: 'security.ip_blocked', description: 'IP blocked', category: 'security' },
  { name: 'security.ip_unblocked', description: 'IP unblocked', category: 'security' },
  { name: 'security.device_blocked', description: 'Device blocked', category: 'security' },
  { name: 'security.device_unblocked', description: 'Device unblocked', category: 'security' },
  { name: 'security.2fa_enabled', description: '2FA enabled', category: 'security' },
  { name: 'security.2fa_disabled', description: '2FA disabled', category: 'security' },
  { name: 'security.suspicious_activity', description: 'Suspicious activity', category: 'security' },
  { name: 'security.breach_detected', description: 'Breach detected', category: 'security' },

  // Agents
  { name: 'agent.created', description: 'Agent created', category: 'agents' },
  { name: 'agent.updated', description: 'Agent updated', category: 'agents' },
  { name: 'agent.deleted', description: 'Agent deleted', category: 'agents' },
  { name: 'agent.downloaded', description: 'Agent downloaded', category: 'agents' },
  { name: 'agent.version_updated', description: 'Version updated', category: 'agents' },
  { name: 'agent.status_changed', description: 'Status changed', category: 'agents' },
  { name: 'agent.product_assigned', description: 'Product assigned', category: 'agents' },
  { name: 'agent.product_unassigned', description: 'Product unassigned', category: 'agents' },
  // Remote Control
  { name: 'remote.feature_enabled', description: 'Feature enabled', category: 'remote' },
  { name: 'remote.feature_disabled', description: 'Feature disabled', category: 'remote' },
  { name: 'remote.feature_updated', description: 'Feature updated', category: 'remote' },
  { name: 'remote.category_created', description: 'Category created', category: 'remote' },
  { name: 'remote.category_updated', description: 'Category updated', category: 'remote' },
  { name: 'remote.category_deleted', description: 'Category deleted', category: 'remote' },

  // Notifications
  { name: 'notification.created', description: 'Notification created', category: 'notifications' },
  { name: 'notification.sent', description: 'Notification sent', category: 'notifications' },
  { name: 'notification.read', description: 'Notification read', category: 'notifications' },

  // RBAC
  { name: 'rbac.role_created', description: 'Role created', category: 'rbac' },
  { name: 'rbac.role_updated', description: 'Role updated', category: 'rbac' },
  { name: 'rbac.role_deleted', description: 'Role deleted', category: 'rbac' },
  { name: 'rbac.permission_granted', description: 'Permission granted', category: 'rbac' },
  { name: 'rbac.permission_revoked', description: 'Permission revoked', category: 'rbac' },
  { name: 'rbac.user_role_assigned', description: 'Role assigned', category: 'rbac' },
  { name: 'rbac.user_role_removed', description: 'Role removed', category: 'rbac' },

  // Billing & Payments
  { name: 'billing.plan_changed', description: 'Plan changed', category: 'billing' },
  { name: 'billing.payment_success', description: 'Payment success', category: 'billing' },
  { name: 'billing.payment_failed', description: 'Payment failed', category: 'billing' },
  { name: 'billing.subscription_expired', description: 'Subscription expired', category: 'billing' },
  { name: 'billing.subscription_renewed', description: 'Subscription renewed', category: 'billing' },
  { name: 'billing.invoice_created', description: 'Invoice created', category: 'billing' },
  { name: 'payment.completed', description: 'Payment completed', category: 'payments' },
  { name: 'payment.failed', description: 'Payment failed', category: 'payments' },
  { name: 'payment.refunded', description: 'Payment refunded', category: 'payments' },
];
