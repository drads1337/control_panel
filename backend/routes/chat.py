import json
import logging
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..core.extensions import db
from ..models.chat import ChatGroup, ChatGroupProduct, ChatMessage, DiscordWebhook, TelegramBot
from ..models.core import Project, User
from ..models.products import Product, ProductChatSettings
from ..models.keys import Key
from ..models.agents import Agent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)

import os as _os

from ..middleware.auth import enforce_project_scope

def find_product_by_id_or_unique_id(product_identifier, project_id):
    """
    Helper function to find a product by either id (int) or unique_id (string)
    
    Args:
        product_identifier: Either an integer id or string unique_id
        project_id: Project ID to filter by
    
    Returns:
        Product object or None if not found
    """
    # Try as integer id (primary key) first
    if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and product_identifier.isdigit()):
        try:
            product_id_int = int(product_identifier)
            product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
            if product:
                return product
        except (ValueError, TypeError):
            pass
    
    # Try as unique_id (string)
    product = Product.query.filter_by(unique_id=str(product_identifier), project_id=project_id).first()
    return product

class TelegramBotManager:
    """
    Telegram Bot Manager - Synchronous implementation
    
    OPTIMIZATION: Changed from async telegram.Bot to synchronous HTTP API
    to avoid creating new event loops in Flask routes (which is inefficient).
    Uses requests library like webhook_service for consistency.
    """

    def __init__(self):
        self.bots = {}
        self.timeout = 10  # Request timeout in seconds

    def send_message(self, bot_token, chat_id, message, parse_mode="HTML"):
        """
        Send message to Telegram using synchronous HTTP API
        
        Args:
            bot_token: Telegram bot token
            chat_id: Telegram chat ID
            message: Message text
            parse_mode: Message parse mode (default: HTML)
            
        Returns:
            message_id if successful, None otherwise
        """
        try:
            import requests
            
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": parse_mode,
            }
            
            response = requests.post(url, json=payload, timeout=self.timeout)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("ok"):
                    return result.get("result", {}).get("message_id")
            else:
                logger.error(f"Telegram API error: HTTP {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.Timeout:
            logger.error(f"Error sending message to Telegram: Request timeout")
            return None
        except requests.exceptions.ConnectionError:
            logger.error(f"Error sending message to Telegram: Connection error")
            return None
        except Exception as e:
            logger.error(f"Error sending message to Telegram: {e}")
            return None

    def get_bot_info(self, bot_token):
        """
        Get bot information using synchronous HTTP API
        
        Args:
            bot_token: Telegram bot token
            
        Returns:
            Bot info dict with username, or None if error
        """
        try:
            import requests
            
            url = f"https://api.telegram.org/bot{bot_token}/getMe"
            response = requests.get(url, timeout=self.timeout)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("ok"):
                    return result.get("result")
            else:
                logger.error(f"Telegram API error getting bot info: HTTP {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting bot info: {e}")
            return None

    def format_message(self, sender_type, sender_name, message):
        role_emoji = {"admin": "👑", "seller": "💰", "developer": "🔧", "client": "👤"}

        emoji = role_emoji.get(sender_type, "❓")
        return f"{emoji} <b>{sender_name}</b>\n{message}"

bot_manager = TelegramBotManager()

@chat_bp.route("/messages", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_messages(project_id=None):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not project_id:
            return jsonify({"error": "User not associated with any project"}), 400

        product_id = request.args.get("product_id", type=int)
        agent_id = request.args.get("agent_id", type=int)
        group_id = request.args.get("group_id", type=int)

        query = ChatMessage.query.filter_by(project_id=project_id)

        if product_id:
            query = query.filter(ChatMessage.product_id == product_id)
        if agent_id:
            query = query.filter(ChatMessage.agent_id == agent_id)
        if group_id:
            query = query.filter(ChatMessage.group_id == group_id)

        messages = query.order_by(ChatMessage.created_at.desc()).limit(100).all()

        messages_data = []
        for msg in reversed(messages):
            message_data = {
                "id": msg.id,
                "sender_type": msg.sender_type,
                "sender_name": msg.sender_display_name,
                "message": msg.message,
                "created_at": msg.created_at.isoformat(),
                "is_sent_to_telegram": msg.is_sent_to_telegram,
                "product_id": msg.product_id,
                "agent_id": msg.agent_id,
                "group_id": msg.group_id,
            }
            messages_data.append(message_data)

        return jsonify({"messages": messages_data})

    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/messages", methods=["POST"])
@jwt_required()
@enforce_project_scope
def send_message(project_id=None):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not project_id:
            return jsonify({"error": "User not associated with any project"}), 400

        data = request.get_json()
        message_text = data.get("message", "").strip()
        product_id = data.get("product_id")
        agent_id = data.get("agent_id")
        group_id = data.get("group_id")
        platforms = data.get("platforms") or ["telegram", "discord"]
        platforms_set = set([p for p in platforms if isinstance(p, str)])

        if not message_text:
            return jsonify({"error": "Message cannot be empty"}), 400

        sender_type = (
            RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else (
                "client"
                if RBACManager.has_any_role(current_user, ["admin", "seller", "developer"])
                else "client"
            )
        )

        from ..utils.project_settings_migration import ProjectSettingsHelper
        helper = ProjectSettingsHelper(project_id)
        chat_settings = helper.get_chat_settings()
        product_settings = None
        if product_id:
            product_settings = ProductChatSettings.query.filter_by(
                product_id=product_id, project_id=project_id
            ).first()
        if chat_settings:
            max_len = (
                product_settings.message_max_length
                if (product_settings and product_settings.message_max_length is not None)
                else chat_settings.chat_message_max_length
            )
            per_min = (
                product_settings.message_limit_per_minute
                if (product_settings and product_settings.message_limit_per_minute is not None)
                else chat_settings.chat_message_limit_per_minute
            )
            daily = (
                product_settings.daily_message_limit
                if (product_settings and product_settings.daily_message_limit is not None)
                else chat_settings.chat_daily_message_limit
            )
            if max_len and len(message_text) > max_len:
                return (
                    jsonify({"error": f"Message too long (>{chat_settings.chat_message_max_length})"}),
                    400,
                )

            if per_min and per_min > 0:
                since = datetime.utcnow() - timedelta(minutes=1)
                recent_count = ChatMessage.query.filter(
                    ChatMessage.project_id == project_id, ChatMessage.created_at >= since
                ).count()
                if recent_count >= per_min:
                    return jsonify({"error": "Rate limit exceeded (per minute)"}), 429

            if daily and daily > 0:
                start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
                daily_count = ChatMessage.query.filter(
                    ChatMessage.project_id == project_id, ChatMessage.created_at >= start_of_day
                ).count()
                if daily_count >= daily:
                    return jsonify({"error": "Daily message limit reached"}), 429

        if product_id:
            product = Product.query.filter_by(id=product_id, project_id=project_id).first()
            if not product:
                return jsonify({"error": "Product not found"}), 404
        if agent_id:
            agent = Agent.query.filter_by(id=agent_id, project_id=project_id).first()
            if not agent:
                return jsonify({"error": "Agent not found"}), 404
        if group_id:
            group = ChatGroup.query.filter_by(id=group_id, project_id=project_id).first()
            if not group:
                return jsonify({"error": "Group not found"}), 404

        chat_message = ChatMessage(
            project_id=project_id,
            sender_type=sender_type,
            sender_id=user.id if sender_type != "client" else None,
            message=message_text,
            created_at=datetime.utcnow(),
            product_id=product_id,
            agent_id=agent_id,
            group_id=group_id,
        )

        db.session.add(chat_message)
        db.session.commit()

        telegram_bot = TelegramBot.query.filter_by(project_id=project_id, is_active=True).first()

        product_settings = None
        if product_id:
            product_settings = ProductChatSettings.query.filter_by(
                product_id=product_id, project_id=project_id
            ).first()

        telegram_allowed = "telegram" in platforms_set
        discord_allowed = "discord" in platforms_set
        if product_settings:
            if not product_settings.telegram_enabled:
                telegram_allowed = False
            if not product_settings.discord_enabled:
                discord_allowed = False

        if telegram_bot and telegram_allowed:
            sender_name = (
                user.username
                if user.username
                else f"{RBACManager.get_user_role_names(user)[0] if RBACManager.get_user_role_names(user) else "client".title()} ({user.id})"
            )
            formatted_message = bot_manager.format_message(sender_type, sender_name, message_text)

            try:
                # OPTIMIZATION: Use synchronous HTTP API instead of async event loop
                telegram_message_id = bot_manager.send_message(
                    telegram_bot.bot_token, telegram_bot.chat_id, formatted_message
                )

                if telegram_message_id:
                    chat_message.telegram_message_id = str(telegram_message_id)
                    chat_message.is_sent_to_telegram = True
                    db.session.commit()
            except Exception as e:
                logger.error(f"Error sending to Telegram: {e}")

        try:
            discord_hooks = DiscordWebhook.query.filter_by(
                project_id=project_id, is_active=True
            ).all()
            if discord_hooks and discord_allowed:
                payload = {
                    "content": f"[{sender_type.upper()}] {user.username if user and user.username else 'User'}: {message_text}"
                }
                for hook in discord_hooks:
                    try:
                        import requests

                        requests.post(hook.webhook_url, json=payload, timeout=5)
                    except Exception as e:
                        logger.error(f"Error sending to Discord webhook {hook.id}: {e}")
        except Exception as e:
            logger.error(f"Error sending to Discord: {e}")

        response_data = {
            "id": chat_message.id,
            "sender_type": chat_message.sender_type,
            "sender_name": chat_message.sender_display_name,
            "message": chat_message.message,
            "created_at": chat_message.created_at.isoformat(),
            "is_sent_to_telegram": chat_message.is_sent_to_telegram,
            "product_id": chat_message.product_id,
            "agent_id": chat_message.agent_id,
            "group_id": chat_message.group_id,
        }

        return jsonify(response_data), 201

    except Exception as e:
        logger.error(f"Error sending message: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/telegram-bot", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_telegram_bot():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        if (
            RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else "client" != "admin"
        ):
            return jsonify({"error": "Admin access required"}), 403

        project_id = getattr(g, "project_id", user.project_id)
        if not project_id:
            return jsonify({"error": "User not associated with any project"}), 400

        telegram_bot = TelegramBot.query.filter_by(project_id=project_id).first()

        if not telegram_bot:
            return jsonify({"bot_configured": False})

        return jsonify(
            {
                "bot_configured": True,
                "bot_username": telegram_bot.bot_username,
                "is_active": telegram_bot.is_active,
                "created_at": telegram_bot.created_at.isoformat(),
            }
        )

    except Exception as e:
        logger.error(f"Error getting telegram bot: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/telegram-bot", methods=["POST"])
@jwt_required()
@enforce_project_scope
def configure_telegram_bot():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        if (
            RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else "client" != "admin"
        ):
            return jsonify({"error": "Admin access required"}), 403

        project_id = getattr(g, "project_id", user.project_id)
        if not project_id:
            return jsonify({"error": "User not associated with any project"}), 400

        data = request.get_json()
        bot_token = data.get("bot_token", "").strip()
        chat_id = data.get("chat_id", "").strip()

        if not bot_token or not chat_id:
            return jsonify({"error": "Bot token and chat ID are required"}), 400

        existing_bot = TelegramBot.query.filter_by(project_id=project_id).first()

        # OPTIMIZATION: Use synchronous HTTP API instead of async event loop
        bot_info = bot_manager.get_bot_info(bot_token)
        if not bot_info:
            return jsonify({"error": "Invalid bot token"}), 400

        bot_username = bot_info.get("username")

        if existing_bot:
            existing_bot.bot_token = bot_token
            existing_bot.chat_id = chat_id
            existing_bot.bot_username = bot_username
            existing_bot.updated_at = datetime.utcnow()
        else:
            existing_bot = TelegramBot(
                project_id=project_id,
                bot_token=bot_token,
                bot_username=bot_username,
                chat_id=chat_id,
            )
            db.session.add(existing_bot)

        db.session.commit()

        return jsonify(
            {
                "message": "Telegram bot configured successfully",
                "bot_username": existing_bot.bot_username,
            }
        )

    except Exception as e:
        logger.error(f"Error configuring telegram bot: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/telegram-bot", methods=["DELETE"])
@jwt_required()
@enforce_project_scope
def delete_telegram_bot():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        if (
            RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else "client" != "admin"
        ):
            return jsonify({"error": "Admin access required"}), 403

        project_id = getattr(g, "project_id", user.project_id)
        if not project_id:
            return jsonify({"error": "User not associated with any project"}), 400

        telegram_bot = TelegramBot.query.filter_by(project_id=project_id).first()

        if not telegram_bot:
            return jsonify({"error": "Telegram bot not found"}), 404

        db.session.delete(telegram_bot)
        db.session.commit()

        return jsonify({"message": "Telegram bot deleted successfully"})

    except Exception as e:
        logger.error(f"Error deleting telegram bot: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/client-message", methods=["POST"])
def send_client_message():
    try:
        data = request.get_json()
        message_text = data.get("message", "").strip()
        client_key = data.get("key", "").strip()
        project_name = data.get("project", "").strip()
        product_id = data.get("product_id")
        agent_id = data.get("agent_id")
        group_id = data.get("group_id")
        platforms = data.get("platforms") or ["telegram", "discord"]
        platforms_set = set([p for p in platforms if isinstance(p, str)])

        if not message_text or not client_key or not project_name:
            return jsonify({"error": "Message, key and project are required"}), 400

        project = Project.query.filter_by(name=project_name).first()
        if not project:
            return jsonify({"error": "Project not found"}), 404

        key = Key.query.filter_by(key=client_key, project_id=project.id, status=1).first()

        if not key:
            return jsonify({"error": "Invalid or inactive key"}), 403

        from ..utils.project_settings_migration import ProjectSettingsHelper
        helper = ProjectSettingsHelper(project.id)
        chat_settings = helper.get_chat_settings()
        
        # Use chat settings from specialized model
        if chat_settings:
            if (
                chat_settings.chat_message_max_length
                and len(message_text) > chat_settings.chat_message_max_length
            ):
                return (
                    jsonify({"error": f"Message too long (>{chat_settings.chat_message_max_length})"}),
                    400,
                )
            if (
                chat_settings.chat_message_limit_per_minute
                and chat_settings.chat_message_limit_per_minute > 0
            ):
                since = datetime.utcnow() - timedelta(minutes=1)
                recent_count = ChatMessage.query.filter(
                    ChatMessage.project_id == project.id, ChatMessage.created_at >= since
                ).count()
                if recent_count >= chat_settings.chat_message_limit_per_minute:
                    return jsonify({"error": "Rate limit exceeded (per minute)"}), 429
            if chat_settings.chat_daily_message_limit and chat_settings.chat_daily_message_limit > 0:
                start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
                daily_count = ChatMessage.query.filter(
                    ChatMessage.project_id == project.id, ChatMessage.created_at >= start_of_day
                ).count()
                if daily_count >= chat_settings.chat_daily_message_limit:
                    return jsonify({"error": "Daily message limit reached"}), 429

        if product_id:
            product = Product.query.filter_by(id=product_id, project_id=project.id).first()
            if not product:
                return jsonify({"error": "Product not found"}), 404
        if agent_id:
            agent = Agent.query.filter_by(id=agent_id, project_id=project.id).first()
            if not agent:
                return jsonify({"error": "Agent not found"}), 404
        if group_id:
            group = ChatGroup.query.filter_by(id=group_id, project_id=project.id).first()
            if not group:
                return jsonify({"error": "Group not found"}), 404

        chat_message = ChatMessage(
            project_id=project.id,
            sender_type="client",
            sender_key=client_key,
            message=message_text,
            created_at=datetime.utcnow(),
            product_id=product_id,
            agent_id=agent_id,
            group_id=group_id,
        )

        db.session.add(chat_message)
        db.session.commit()

        telegram_bot = TelegramBot.query.filter_by(project_id=project.id, is_active=True).first()

        if telegram_bot and ("telegram" in platforms_set):
            sender_name = f"Client ({client_key[-4:]})"
            formatted_message = bot_manager.format_message("client", sender_name, message_text)

            try:
                # OPTIMIZATION: Use synchronous HTTP API instead of async event loop
                telegram_message_id = bot_manager.send_message(
                    telegram_bot.bot_token, telegram_bot.chat_id, formatted_message
                )

                if telegram_message_id:
                    chat_message.telegram_message_id = str(telegram_message_id)
                    chat_message.is_sent_to_telegram = True
                    db.session.commit()
            except Exception as e:
                logger.error(f"Error sending to Telegram: {e}")

        try:
            discord_hooks = DiscordWebhook.query.filter_by(
                project_id=project.id, is_active=True
            ).all()
            if discord_hooks and ("discord" in platforms_set):
                payload = {
                    "content": f"[CLIENT] {client_key[-4:] if client_key else ''}: {message_text}"
                }
                for hook in discord_hooks:
                    try:
                        import requests

                        requests.post(hook.webhook_url, json=payload, timeout=5)
                    except Exception as e:
                        logger.error(f"Error sending to Discord webhook {hook.id}: {e}")

        except Exception as e:
            logger.error(f"Error sending to Discord: {e}")

        return jsonify({"message": "Message sent successfully"}), 201

    except Exception as e:
        logger.error(f"Error sending client message: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/products/<product_identifier>/settings", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_product_chat_settings(product_identifier):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
            return jsonify({"error": "User not found"}), 404
        project_id = getattr(g, "project_id", user.project_id)
        product = find_product_by_id_or_unique_id(product_identifier, project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404
        s = ProductChatSettings.query.filter_by(product_id=product.id, project_id=project_id).first()
        if not s:

            helper = ProjectSettingsHelper(project_id)
            chat_settings = helper.get_chat_settings()
            return jsonify(
                {
                    "telegram_enabled": True,
                    "discord_enabled": True,
                    "message_limit_per_minute": chat_settings.chat_message_limit_per_minute,
                    "daily_message_limit": None,
                    "message_max_length": None,
                    "defaults": {
                        "chat_message_limit_per_minute": (
                            ps.chat_message_limit_per_minute if ps else 30
                        ),
                        "chat_daily_message_limit": ps.chat_daily_message_limit if ps else 1000,
                        "chat_message_max_length": ps.chat_message_max_length if ps else 1000,
                    },
                }
            )
        return jsonify(
            {
                "telegram_enabled": s.telegram_enabled,
                "discord_enabled": s.discord_enabled,
                "message_limit_per_minute": s.message_limit_per_minute,
                "daily_message_limit": s.daily_message_limit,
                "message_max_length": s.message_max_length,
            }
        )
    except Exception as e:
        logger.error(f"Error getting product chat settings: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/products/<product_identifier>/settings", methods=["PUT"])
@jwt_required()
@enforce_project_scope
def update_product_chat_settings(product_identifier):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        if (
            RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else "client" != "admin"
        ):
            return jsonify({"error": "Admin access required"}), 403
        project_id = getattr(g, "project_id", user.project_id)
        product = find_product_by_id_or_unique_id(product_identifier, project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404
        data = request.get_json()
        s = ProductChatSettings.query.filter_by(product_id=product.id, project_id=project_id).first()
        if not s:
            s = ProductChatSettings(product_id=product.id, project_id=project_id)
            db.session.add(s)
        if "telegram_enabled" in data:
            s.telegram_enabled = bool(data.get("telegram_enabled"))
        if "discord_enabled" in data:
            s.discord_enabled = bool(data.get("discord_enabled"))
        if "message_limit_per_minute" in data:
            v = data.get("message_limit_per_minute")
            s.message_limit_per_minute = int(v) if (v is not None and v != "") else None
        if "daily_message_limit" in data:
            v = data.get("daily_message_limit")
            s.daily_message_limit = int(v) if (v is not None and v != "") else None
        if "message_max_length" in data:
            v = data.get("message_max_length")
            s.message_max_length = int(v) if (v is not None and v != "") else None
        db.session.commit()
        return jsonify({"message": "Product chat settings updated"})
    except Exception as e:
        logger.error(f"Error updating product chat settings: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/settings", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_chat_settings():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
            return jsonify({"error": "User not found"}), 404
        project_id = getattr(g, "project_id", user.project_id)
        if not project_id:
            return jsonify({"error": "User not associated with any project"}), 400
        helper = ProjectSettingsHelper(project_id)
        chat_settings = helper.get_chat_settings()
        return jsonify(
            {
                "chat_message_limit_per_minute": chat_settings.chat_message_limit_per_minute,
                "chat_daily_message_limit": chat_settings.chat_daily_message_limit,
                "chat_message_max_length": chat_settings.chat_message_max_length,
            }
        )
    except Exception as e:
        logger.error(f"Error getting chat settings: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/settings", methods=["PUT"])
@jwt_required()
@enforce_project_scope
def update_chat_settings():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        if (
            RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else "client" != "admin"
        ):
            return jsonify({"error": "Admin access required"}), 403
        project_id = getattr(g, "project_id", user.project_id)
        if not project_id:
            return jsonify({"error": "User not associated with any project"}), 400
        data = request.get_json()
        helper = ProjectSettingsHelper(project_id)
        chat_settings = helper.get_chat_settings()
        if "chat_message_limit_per_minute" in data:
            chat_settings.chat_message_limit_per_minute = int(
                data.get("chat_message_limit_per_minute") or 0
            )
        if "chat_daily_message_limit" in data:
            chat_settings.chat_daily_message_limit = int(data.get("chat_daily_message_limit") or 0)
        if "chat_message_max_length" in data:
            chat_settings.chat_message_max_length = int(data.get("chat_message_max_length") or 0)
        db.session.commit()
        return jsonify({"message": "Chat settings updated"})
    except Exception as e:
        logger.error(f"Error updating chat settings: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/discord-webhooks", methods=["GET"])
@jwt_required()
@enforce_project_scope
def list_discord_webhooks():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
            return jsonify({"error": "User not found"}), 404
        if not user.project_id and not hasattr(g, "project_id"):
            return jsonify({"error": "User not associated with any project"}), 400
        project_id = getattr(g, "project_id", user.project_id)
        hooks = (
            DiscordWebhook.query.filter_by(project_id=project_id)
            .order_by(DiscordWebhook.created_at.desc())
            .all()
        )
        return jsonify(
            {
                "webhooks": [
                    {
                        "id": h.id,
                        "name": h.name,
                        "is_active": h.is_active,
                        "created_at": h.created_at.isoformat(),
                    }
                    for h in hooks
                ]
            }
        )
    except Exception as e:
        logger.error(f"Error listing discord webhooks: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/discord-webhooks", methods=["POST"])
@jwt_required()
@enforce_project_scope
def add_discord_webhook():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
        if (
            not user or RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else "client" != "admin"
        ):
            return jsonify({"error": "Admin access required"}), 403
        if not user.project_id and not hasattr(g, "project_id"):
            return jsonify({"error": "User not associated with any project"}), 400
        data = request.get_json()
        webhook_url = (data.get("webhook_url") or "").strip()
        name = (data.get("name") or "").strip() or None
        if not webhook_url:
            return jsonify({"error": "Webhook URL is required"}), 400
        project_id = getattr(g, "project_id", user.project_id)
        hook = DiscordWebhook(project_id=project_id, webhook_url=webhook_url, name=name)
        db.session.add(hook)
        db.session.commit()
        return jsonify({"id": hook.id, "name": hook.name, "is_active": hook.is_active}), 201
    except Exception as e:
        logger.error(f"Error adding discord webhook: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/discord-webhooks/<int:hook_id>", methods=["PUT"])
@jwt_required()
@enforce_project_scope
def update_discord_webhook(hook_id: int):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
        if (
            not user or RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else "client" != "admin"
        ):
            return jsonify({"error": "Admin access required"}), 403
        if not user.project_id and not hasattr(g, "project_id"):
            return jsonify({"error": "User not associated with any project"}), 400
        project_id = getattr(g, "project_id", user.project_id)
        hook = DiscordWebhook.query.filter_by(id=hook_id, project_id=project_id).first()
        if not hook:
            return jsonify({"error": "Webhook not found"}), 404
        data = request.get_json()
        if "name" in data:
            hook.name = (data.get("name") or "").strip() or None
        if "is_active" in data:
            hook.is_active = bool(data.get("is_active"))
        db.session.commit()
        return jsonify({"message": "Webhook updated"})
    except Exception as e:
        logger.error(f"Error updating discord webhook: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/discord-webhooks/<int:hook_id>", methods=["DELETE"])
@jwt_required()
@enforce_project_scope
def delete_discord_webhook(hook_id: int):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
        if (
            not user or RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else "client" != "admin"
        ):
            return jsonify({"error": "Admin access required"}), 403
        if not user.project_id and not hasattr(g, "project_id"):
            return jsonify({"error": "User not associated with any project"}), 400
        project_id = getattr(g, "project_id", user.project_id)
        hook = DiscordWebhook.query.filter_by(id=hook_id, project_id=project_id).first()
        if not hook:
            return jsonify({"error": "Webhook not found"}), 404
        db.session.delete(hook)
        db.session.commit()
        return jsonify({"message": "Webhook deleted"})
    except Exception as e:
        logger.error(f"Error deleting discord webhook: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/groups", methods=["GET"])
@jwt_required()
@enforce_project_scope
def list_groups():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
            return jsonify({"error": "User not found"}), 404
        if not user.project_id and not hasattr(g, "project_id"):
            return jsonify({"error": "User not associated with any project"}), 400
        project_id = getattr(g, "project_id", user.project_id)
        groups = (
            ChatGroup.query.filter_by(project_id=project_id)
            .order_by(ChatGroup.created_at.desc())
            .all()
        )
        return jsonify(
            {
                "groups": [
                    {
                        "id": g.id,
                        "name": g.name,
                        "description": g.description,
                        "is_active": g.is_active,
                        "created_at": g.created_at.isoformat(),
                    }
                    for g in groups
                ]
            }
        )
    except Exception as e:
        logger.error(f"Error listing groups: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/groups", methods=["POST"])
@jwt_required()
@enforce_project_scope
def create_group():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
            return jsonify({"error": "User not found"}), 404
        if not user.project_id and not hasattr(g, "project_id"):
            return jsonify({"error": "User not associated with any project"}), 400

        data = request.get_json()
        name = (data.get("name") or "").strip()
        description = (data.get("description") or "").strip() or None
        product_ids = data.get("product_ids") or []

        if not name:
            return jsonify({"error": "Name is required"}), 400

        project_id = getattr(g, "project_id", user.project_id)
        group = ChatGroup(project_id=project_id, name=name, description=description)
        db.session.add(group)
        db.session.flush()

        valid_products = (
            Product.query.filter(Product.id.in_(product_ids), Product.project_id == project_id).all()
            if product_ids
            else []
        )
        for product in valid_products:
            db.session.add(ChatGroupProduct(group_id=group.id, product_id=product.id, project_id=project_id))

        db.session.commit()

        return (
            jsonify(
                {
                    "id": group.id,
                    "name": group.name,
                    "description": group.description,
                    "is_active": group.is_active,
                }
            ),
            201,
        )
    except Exception as e:
        logger.error(f"Error creating group: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/groups/<int:group_id>", methods=["PUT"])
@jwt_required()
@enforce_project_scope
def update_group(group_id: int):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
            return jsonify({"error": "User not found"}), 404
        if not user.project_id and not hasattr(g, "project_id"):
            return jsonify({"error": "User not associated with any project"}), 400
        project_id = getattr(g, "project_id", user.project_id)
        group = ChatGroup.query.filter_by(id=group_id, project_id=project_id).first()
        if not group:
            return jsonify({"error": "Group not found"}), 404

        data = request.get_json()
        if "name" in data:
            group.name = (data.get("name") or "").strip() or group.name
        if "description" in data:
            group.description = (data.get("description") or "").strip() or None
        if "is_active" in data:
            group.is_active = bool(data.get("is_active"))
        if "product_ids" in data:

            ChatGroupProduct.query.filter_by(group_id=group.id).delete()
            product_ids = data.get("product_ids") or []
            valid_products = (
                Product.query.filter(Product.id.in_(product_ids), Product.project_id == project_id).all()
                if product_ids
                else []
            )
            for product in valid_products:
                db.session.add(
                    ChatGroupProduct(group_id=group.id, product_id=product.id, project_id=project_id)
                )

        db.session.commit()
        return jsonify({"message": "Group updated"})
    except Exception as e:
        logger.error(f"Error updating group: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/groups/<int:group_id>", methods=["DELETE"])
@jwt_required()
@enforce_project_scope
def delete_group(group_id: int):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
            return jsonify({"error": "User not found"}), 404
        if not user.project_id and not hasattr(g, "project_id"):
            return jsonify({"error": "User not associated with any project"}), 400
        project_id = getattr(g, "project_id", user.project_id)
        group = ChatGroup.query.filter_by(id=group_id, project_id=project_id).first()
        if not group:
            return jsonify({"error": "Group not found"}), 404

        ChatGroupProduct.query.filter_by(group_id=group.id).delete()
        db.session.delete(group)
        db.session.commit()
        return jsonify({"message": "Group deleted"})

    except Exception as e:
        logger.error(f"Error deleting group: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500
