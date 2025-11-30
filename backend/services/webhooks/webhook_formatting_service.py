"""
Webhook Formatting Service
Handles message formatting for Telegram and Discord webhooks
"""

import logging
from datetime import datetime
from typing import Dict, List

class WebhookFormattingService:
    """Service for formatting webhook messages for different platforms"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def get_valid_events(self) -> List[str]:
        """Get list of valid webhook events"""
        return [

            "key.created",
            "key.activated",
            "key.expired",
            "key.blocked",
            "key.unblocked",
            "key.deleted",
            "key.updated",
            "key.used",
            "key.renewed",
            "key.suspended",
            "key.unsuspended",

            "connect.success",
            "connect.failed",
            "connect.disconnected",
            "connect.challenge_requested",
            "connect.token_generated",
            "connect.token_expired",

            "user.created",
            "user.registered",
            "user.login",
            "user.logout",
            "user.password_changed",
            "user.role_changed",
            "user.deleted",
            "user.updated",
            "user.suspended",
            "user.activated",
            "user.email_changed",
            "user.profile_updated",
            "user.2fa_enabled",
            "user.2fa_disabled",

            "product.created",
            "product.updated",
            "product.activated",
            "product.deactivated",
            "product.deleted",
            "product.file_uploaded",
            "product.file_downloaded",
            "product.settings_changed",
            "product.version_updated",

            "security.alert",
            "security.block",
            "security.login_failed",
            "security.ip_blocked",
            "security.ip_unblocked",
            "security.device_blocked",
            "security.device_unblocked",
            "security.2fa_enabled",
            "security.2fa_disabled",
            "security.suspicious_activity",
            "security.breach_detected",

            "agent.created",
            "agent.updated",
            "agent.deleted",
            "agent.downloaded",
            "agent.version_updated",
            "agent.status_changed",
            "agent.product_assigned",
            "agent.product_unassigned",

            "server.created",
            "server.updated",
            "server.deleted",
            "server.status_changed",
            "server.connected",
            "server.disconnected",

            "remote.feature_enabled",
            "remote.feature_disabled",
            "remote.feature_updated",
            "remote.category_created",
            "remote.category_updated",
            "remote.category_deleted",

            "notification.created",
            "notification.sent",
            "notification.read",

            "rbac.role_created",
            "rbac.role_updated",
            "rbac.role_deleted",
            "rbac.permission_granted",
            "rbac.permission_revoked",
            "rbac.user_role_assigned",
            "rbac.user_role_removed",

            "billing.plan_changed",
            "billing.payment_success",
            "billing.payment_failed",
            "billing.subscription_expired",
            "billing.subscription_renewed",
            "billing.invoice_created",
            "payment.completed",
            "payment.failed",
            "payment.refunded",
        ]

    def format_telegram_message(self, event: str, data: Dict, custom_template: str = None) -> str:
        """Format message for Telegram"""
        if custom_template:
            try:
                message = custom_template
                for key, value in data.items():
                    placeholder = f"{{{key}}}"
                    if placeholder in message:
                        message = message.replace(placeholder, str(value))
                return message
            except Exception as e:
                self.logger.error(f"Error processing custom template: {e}")

        event_names = {

            "key.created": "🔑 New key created",
            "key.activated": "✅ Key activated",
            "key.expired": "⏰ Key expired",
            "key.blocked": "🚫 Key blocked",
            "key.unblocked": "✅ Key unblocked",
            "key.deleted": "🗑️ Key deleted",
            "key.updated": "📝 Key updated",
            "key.used": "🔓 Key used",
            "key.renewed": "🔄 Key renewed",
            "key.suspended": "⏸️ Key suspended",
            "key.unsuspended": "▶️ Key unsuspended",

            "connect.success": "✅ Client connected",
            "connect.failed": "❌ Connection failed",
            "connect.disconnected": "🔌 Client disconnected",
            "connect.challenge_requested": "🔐 Challenge requested",
            "connect.token_generated": "🎫 Token generated",
            "connect.token_expired": "⏰ Token expired",

            "user.created": "👤 New user created",
            "user.registered": "👤 New user registered",
            "user.login": "🔐 User login",
            "user.logout": "👋 User logout",
            "user.password_changed": "🔐 Password changed",
            "user.role_changed": "👑 User role changed",
            "user.deleted": "🗑️ User deleted",
            "user.updated": "📝 User updated",
            "user.suspended": "⏸️ User suspended",
            "user.activated": "✅ User activated",
            "user.email_changed": "📧 Email changed",
            "user.profile_updated": "📝 Profile updated",
            "user.2fa_enabled": "🔒 2FA enabled",
            "user.2fa_disabled": "🔓 2FA disabled",

            "product.created": "🎮 New product created",
            "product.updated": "📝 Product updated",
            "product.activated": "✅ Product activated",
            "product.deactivated": "❌ Product deactivated",
            "product.deleted": "🗑️ Product deleted",
            "product.file_uploaded": "📤 File uploaded",
            "product.file_downloaded": "📥 File downloaded",
            "product.settings_changed": "⚙️ Settings changed",
            "product.version_updated": "🔄 Version updated",

            "security.alert": "⚠️ Security alert",
            "security.block": "🚫 Security block",
            "security.login_failed": "❌ Login failed",
            "security.ip_blocked": "🚫 IP blocked",
            "security.ip_unblocked": "✅ IP unblocked",
            "security.device_blocked": "🚫 Device blocked",
            "security.device_unblocked": "✅ Device unblocked",
            "security.2fa_enabled": "🔒 2FA enabled",
            "security.2fa_disabled": "🔓 2FA disabled",
            "security.suspicious_activity": "⚠️ Suspicious activity",
            "security.breach_detected": "🚨 Breach detected",

            "agent.created": "🤖 Agent created",
            "agent.updated": "📝 Agent updated",
            "agent.deleted": "🗑️ Agent deleted",
            "agent.downloaded": "📥 Agent downloaded",
            "agent.version_updated": "🔄 Version updated",
            "agent.status_changed": "🔄 Status changed",
            "agent.product_assigned": "➕ Product assigned",
            "agent.product_unassigned": "➖ Product unassigned",

            "server.created": "🖥️ Server created",
            "server.updated": "📝 Server updated",
            "server.deleted": "🗑️ Server deleted",
            "server.status_changed": "🔄 Status changed",
            "server.connected": "🔌 Server connected",
            "server.disconnected": "🔌 Server disconnected",

            "remote.feature_enabled": "✅ Feature enabled",
            "remote.feature_disabled": "❌ Feature disabled",
            "remote.feature_updated": "📝 Feature updated",
            "remote.category_created": "📁 Category created",
            "remote.category_updated": "📝 Category updated",
            "remote.category_deleted": "🗑️ Category deleted",

            "notification.created": "📢 Notification created",
            "notification.sent": "📤 Notification sent",
            "notification.read": "👁️ Notification read",

            "rbac.role_created": "👑 Role created",
            "rbac.role_updated": "📝 Role updated",
            "rbac.role_deleted": "🗑️ Role deleted",
            "rbac.permission_granted": "✅ Permission granted",
            "rbac.permission_revoked": "❌ Permission revoked",
            "rbac.user_role_assigned": "➕ Role assigned",
            "rbac.user_role_removed": "➖ Role removed",

            "billing.plan_changed": "💳 Plan changed",
            "billing.payment_success": "✅ Payment success",
            "billing.payment_failed": "❌ Payment failed",
            "billing.subscription_expired": "⏰ Subscription expired",
            "billing.subscription_renewed": "🔄 Subscription renewed",
            "billing.invoice_created": "📄 Invoice created",
            "payment.completed": "✅ Payment completed",
            "payment.failed": "❌ Payment failed",
            "payment.refunded": "💰 Payment refunded",
        }

        title = event_names.get(event, f"📢 Event: {event}")

        message = f"<b>{title}</b>\n\n"

        if event.startswith("key."):
            message += f"<b>Key:</b> {data.get('key_value', 'N/A')}\n"
            message += f"<b>User ID:</b> {data.get('user_id', 'N/A')}\n"
        elif event.startswith("connect."):
            message += f"<b>Key:</b> {data.get('key_value', 'N/A')}\n"
            message += f"<b>IP:</b> {data.get('ip_address', 'N/A')}\n"
            message += f"<b>User Agent:</b> {data.get('user_agent', 'N/A')}\n"
            message += f"<b>Device:</b> {data.get('device_id', 'N/A')}\n"
        elif event.startswith("user."):
            message += f"<b>User:</b> {data.get('username', 'N/A')}\n"
            message += f"<b>Email:</b> {data.get('email', 'N/A')}\n"
        elif event.startswith("product."):
            message += f"<b>Product:</b> {data.get('product_name', 'N/A')}\n"
            message += f"<b>Status:</b> {data.get('status', 'N/A')}\n"
        elif event.startswith("security."):
            message += f"<b>Details:</b> {data.get('details', 'N/A')}\n"
            message += f"<b>IP:</b> {data.get('ip_address', 'N/A')}\n"
        elif event.startswith("agent."):
            message += f"<b>Agent:</b> {data.get('agent_name', 'N/A')}\n"
            message += f"<b>Agent ID:</b> {data.get('agent_id', 'N/A')}\n"
        elif event.startswith("server."):
            message += f"<b>Server:</b> {data.get('server_name', 'N/A')}\n"
            message += f"<b>IP:</b> {data.get('ip_address', 'N/A')}\n"
        elif event.startswith("remote."):
            message += f"<b>Feature:</b> {data.get('feature_name', 'N/A')}\n"
            message += f"<b>Category:</b> {data.get('category_name', 'N/A')}\n"
        elif event.startswith("notification."):
            message += f"<b>Message:</b> {data.get('message', 'N/A')}\n"
            message += f"<b>Type:</b> {data.get('type', 'N/A')}\n"
        elif event.startswith("rbac."):
            message += f"<b>Role:</b> {data.get('role_name', 'N/A')}\n"
            message += f"<b>User:</b> {data.get('username', 'N/A')}\n"
        elif event.startswith("billing.") or event.startswith("payment."):
            message += f"<b>Amount:</b> {data.get('amount', 'N/A')}\n"
            message += f"<b>Status:</b> {data.get('status', 'N/A')}\n"

        message += f"\n<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"

        return message

    def format_discord_embed(self, event: str, data: Dict) -> Dict:
        """Format embed for Discord"""
        event_info = {

            "key.created": {"title": "🔑 New key created", "color": 0x00FF00},
            "key.activated": {"title": "✅ Key activated", "color": 0x00FF00},
            "key.expired": {"title": "⏰ Key expired", "color": 0xFFAA00},
            "key.blocked": {"title": "🚫 Key blocked", "color": 0xFF0000},
            "key.unblocked": {"title": "✅ Key unblocked", "color": 0x00FF00},
            "key.deleted": {"title": "🗑️ Key deleted", "color": 0x666666},
            "key.updated": {"title": "📝 Key updated", "color": 0x0099FF},
            "key.used": {"title": "🔓 Key used", "color": 0x00FF00},
            "key.renewed": {"title": "🔄 Key renewed", "color": 0x00FF00},
            "key.suspended": {"title": "⏸️ Key suspended", "color": 0xFFAA00},
            "key.unsuspended": {"title": "▶️ Key unsuspended", "color": 0x00FF00},

            "connect.success": {"title": "✅ Client connected", "color": 0x00FF00},
            "connect.failed": {"title": "❌ Connection failed", "color": 0xFF0000},
            "connect.disconnected": {"title": "🔌 Client disconnected", "color": 0xFFAA00},
            "connect.challenge_requested": {"title": "🔐 Challenge requested", "color": 0x0099FF},
            "connect.token_generated": {"title": "🎫 Token generated", "color": 0x00FF00},
            "connect.token_expired": {"title": "⏰ Token expired", "color": 0xFFAA00},

            "user.created": {"title": "👤 New user created", "color": 0x0099FF},
            "user.registered": {"title": "👤 New user registered", "color": 0x0099FF},
            "user.login": {"title": "🔐 User login", "color": 0x00FF00},
            "user.logout": {"title": "👋 User logout", "color": 0x666666},
            "user.password_changed": {"title": "🔐 Password changed", "color": 0xFFFF00},
            "user.role_changed": {"title": "👑 User role changed", "color": 0x9932CC},
            "user.deleted": {"title": "🗑️ User deleted", "color": 0xFF0000},
            "user.updated": {"title": "📝 User updated", "color": 0x0099FF},
            "user.suspended": {"title": "⏸️ User suspended", "color": 0xFFAA00},
            "user.activated": {"title": "✅ User activated", "color": 0x00FF00},
            "user.email_changed": {"title": "📧 Email changed", "color": 0x0099FF},
            "user.profile_updated": {"title": "📝 Profile updated", "color": 0x0099FF},
            "user.2fa_enabled": {"title": "🔒 2FA enabled", "color": 0x00FF00},
            "user.2fa_disabled": {"title": "🔓 2FA disabled", "color": 0xFFAA00},

            "product.created": {"title": "🎮 New product created", "color": 0x00FF00},
            "product.updated": {"title": "📝 Product updated", "color": 0x0099FF},
            "product.activated": {"title": "✅ Product activated", "color": 0x00FF00},
            "product.deactivated": {"title": "❌ Product deactivated", "color": 0xFF0000},
            "product.deleted": {"title": "🗑️ Product deleted", "color": 0xFF0000},
            "product.file_uploaded": {"title": "📤 File uploaded", "color": 0x0099FF},
            "product.file_downloaded": {"title": "📥 File downloaded", "color": 0x0099FF},
            "product.settings_changed": {"title": "⚙️ Settings changed", "color": 0x0099FF},
            "product.version_updated": {"title": "🔄 Version updated", "color": 0x0099FF},

            "project.created": {"title": "🏗️ New project created", "color": 0x00FF00},
            "project.updated": {"title": "📝 Project updated", "color": 0x0099FF},
            "project.deleted": {"title": "🗑️ Project deleted", "color": 0xFF0000},
            "project.settings_changed": {"title": "⚙️ Settings changed", "color": 0x0099FF},
            "project.member_added": {"title": "➕ Member added", "color": 0x00FF00},
            "project.member_removed": {"title": "➖ Member removed", "color": 0xFFAA00},
            "project.invite_created": {"title": "📨 Invite created", "color": 0x0099FF},
            "project.invite_accepted": {"title": "✅ Invite accepted", "color": 0x00FF00},

            "security.alert": {"title": "⚠️ Security alert", "color": 0xFFAA00},
            "security.block": {"title": "🚫 Security block", "color": 0xFF0000},
            "security.login_failed": {"title": "❌ Login failed", "color": 0xFF0000},
            "security.ip_blocked": {"title": "🚫 IP blocked", "color": 0xFF0000},
            "security.ip_unblocked": {"title": "✅ IP unblocked", "color": 0x00FF00},
            "security.device_blocked": {"title": "🚫 Device blocked", "color": 0xFF0000},
            "security.device_unblocked": {"title": "✅ Device unblocked", "color": 0x00FF00},
            "security.2fa_enabled": {"title": "🔒 2FA enabled", "color": 0x00FF00},
            "security.2fa_disabled": {"title": "🔓 2FA disabled", "color": 0xFFAA00},
            "security.suspicious_activity": {"title": "⚠️ Suspicious activity", "color": 0xFFAA00},
            "security.breach_detected": {"title": "🚨 Breach detected", "color": 0xFF0000},

            "agent.created": {"title": "🤖 Agent created", "color": 0x00FF00},
            "agent.updated": {"title": "📝 Agent updated", "color": 0x0099FF},
            "agent.deleted": {"title": "🗑️ Agent deleted", "color": 0xFF0000},
            "agent.downloaded": {"title": "📥 Agent downloaded", "color": 0x0099FF},
            "agent.version_updated": {"title": "🔄 Version updated", "color": 0x0099FF},
            "agent.status_changed": {"title": "🔄 Status changed", "color": 0x0099FF},
            "agent.product_assigned": {"title": "➕ Product assigned", "color": 0x00FF00},
            "agent.product_unassigned": {"title": "➖ Product unassigned", "color": 0xFFAA00},

            "server.created": {"title": "🖥️ Server created", "color": 0x00FF00},
            "server.updated": {"title": "📝 Server updated", "color": 0x0099FF},
            "server.deleted": {"title": "🗑️ Server deleted", "color": 0xFF0000},
            "server.status_changed": {"title": "🔄 Status changed", "color": 0x0099FF},
            "server.connected": {"title": "🔌 Server connected", "color": 0x00FF00},
            "server.disconnected": {"title": "🔌 Server disconnected", "color": 0xFFAA00},

            "remote.feature_enabled": {"title": "✅ Feature enabled", "color": 0x00FF00},
            "remote.feature_disabled": {"title": "❌ Feature disabled", "color": 0xFF0000},
            "remote.feature_updated": {"title": "📝 Feature updated", "color": 0x0099FF},
            "remote.category_created": {"title": "📁 Category created", "color": 0x0099FF},
            "remote.category_updated": {"title": "📝 Category updated", "color": 0x0099FF},
            "remote.category_deleted": {"title": "🗑️ Category deleted", "color": 0xFF0000},

            "notification.created": {"title": "📢 Notification created", "color": 0x0099FF},
            "notification.sent": {"title": "📤 Notification sent", "color": 0x00FF00},
            "notification.read": {"title": "👁️ Notification read", "color": 0x666666},

            "rbac.role_created": {"title": "👑 Role created", "color": 0x00FF00},
            "rbac.role_updated": {"title": "📝 Role updated", "color": 0x0099FF},
            "rbac.role_deleted": {"title": "🗑️ Role deleted", "color": 0xFF0000},
            "rbac.permission_granted": {"title": "✅ Permission granted", "color": 0x00FF00},
            "rbac.permission_revoked": {"title": "❌ Permission revoked", "color": 0xFF0000},
            "rbac.user_role_assigned": {"title": "➕ Role assigned", "color": 0x00FF00},
            "rbac.user_role_removed": {"title": "➖ Role removed", "color": 0xFFAA00},

            "billing.plan_changed": {"title": "💳 Plan changed", "color": 0x0099FF},
            "billing.payment_success": {"title": "✅ Payment success", "color": 0x00FF00},
            "billing.payment_failed": {"title": "❌ Payment failed", "color": 0xFF0000},
            "billing.subscription_expired": {"title": "⏰ Subscription expired", "color": 0xFFAA00},
            "billing.subscription_renewed": {"title": "🔄 Subscription renewed", "color": 0x00FF00},
            "billing.invoice_created": {"title": "📄 Invoice created", "color": 0x0099FF},
            "payment.completed": {"title": "✅ Payment completed", "color": 0x00FF00},
            "payment.failed": {"title": "❌ Payment failed", "color": 0xFF0000},
            "payment.refunded": {"title": "💰 Payment refunded", "color": 0xFFAA00},

            "chat.message_sent": {"title": "💬 Message sent", "color": 0x0099FF},
            "chat.group_created": {"title": "👥 Group created", "color": 0x00FF00},
            "chat.group_updated": {"title": "📝 Group updated", "color": 0x0099FF},
            "chat.group_deleted": {"title": "🗑️ Group deleted", "color": 0xFF0000},

            "system.maintenance": {"title": "🔧 System maintenance", "color": 0x666666},
            "system.error": {"title": "❌ System error", "color": 0xFF0000},
            "system.backup_created": {"title": "💾 Backup created", "color": 0x00FF00},
            "system.backup_restored": {"title": "🔄 Backup restored", "color": 0x0099FF},
            "system.settings_updated": {"title": "⚙️ Settings updated", "color": 0x0099FF},
            "system.startup": {"title": "🚀 System startup", "color": 0x00FF00},
            "system.shutdown": {"title": "🛑 System shutdown", "color": 0xFF0000},
        }

        info = event_info.get(event, {"title": f"📢 Event: {event}", "color": 0x666666})

        embed = {
            "title": info["title"],
            "color": info["color"],
            "timestamp": datetime.utcnow().isoformat(),
            "fields": [],
        }

        if event.startswith("key."):
            embed["fields"].extend(
                [
                    {"name": "Key", "value": data.get("key_value", "N/A"), "inline": True},
                    {
                        "name": "User ID",
                        "value": str(data.get("user_id", "N/A")),
                        "inline": True,
                    },
                ]
            )
        elif event.startswith("connect."):
            embed["fields"].extend(
                [
                    {"name": "Key", "value": data.get("key_value", "N/A"), "inline": True},
                    {"name": "IP", "value": data.get("ip_address", "N/A"), "inline": True},
                    {"name": "User Agent", "value": data.get("user_agent", "N/A")[:100] or "N/A", "inline": False},
                    {"name": "Device", "value": data.get("device_id", "N/A"), "inline": True},
                ]
            )
        elif event.startswith("user."):
            embed["fields"].extend(
                [
                    {"name": "User", "value": data.get("username", "N/A"), "inline": True},
                    {"name": "Email", "value": data.get("email", "N/A"), "inline": True},
                ]
            )
        elif event.startswith("product."):
            embed["fields"].extend(
                [
                    {"name": "Product", "value": data.get("product_name", "N/A"), "inline": True},
                    {"name": "Status", "value": data.get("status", "N/A"), "inline": True},
                ]
            )
        elif event.startswith("security."):
            embed["fields"].extend(
                [
                    {"name": "Details", "value": data.get("details", "N/A"), "inline": False},
                    {"name": "IP", "value": data.get("ip_address", "N/A"), "inline": True},
                ]
            )

        return embed

