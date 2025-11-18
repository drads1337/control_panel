import asyncio
import json
import logging
from datetime import datetime, timedelta

import telegram
from flask import Blueprint, current_app, g, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from telegram.ext import Application

from ..core.extensions import db
from ..models.chat import ChatGroup, ChatGroupGame, ChatMessage, DiscordWebhook, TelegramBot
from ..models.core import Project, ProjectSettings, User
from ..models.games import Game, GameChatSettings
from ..models.keys import Key
from ..models.loaders import Loader

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)

import os as _os

from ..middleware.auth import enforce_project_scope

class TelegramBotManager:

    def __init__(self):
        self.bots = {}

    async def send_message(self, bot_token, chat_id, message, parse_mode="HTML"):
        try:
            bot = telegram.Bot(token=bot_token)
            result = await bot.send_message(chat_id=chat_id, text=message, parse_mode=parse_mode)
            return result.message_id
        except Exception as e:
            logger.error(f"Error sending message to Telegram: {e}")
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

        game_id = request.args.get("game_id", type=int)
        loader_id = request.args.get("loader_id", type=int)
        group_id = request.args.get("group_id", type=int)

        query = ChatMessage.query.filter_by(project_id=project_id)

        if game_id:
            query = query.filter(ChatMessage.game_id == game_id)
        if loader_id:
            query = query.filter(ChatMessage.loader_id == loader_id)
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
                "game_id": msg.game_id,
                "loader_id": msg.loader_id,
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
        game_id = data.get("game_id")
        loader_id = data.get("loader_id")
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

        settings = ProjectSettings.query.filter_by(project_id=project_id).first()
        game_settings = None
        if game_id:
            game_settings = GameChatSettings.query.filter_by(
                game_id=game_id, project_id=project_id
            ).first()
        if settings:
            max_len = (
                game_settings.message_max_length
                if (game_settings and game_settings.message_max_length is not None)
                else settings.chat_message_max_length
            )
            per_min = (
                game_settings.message_limit_per_minute
                if (game_settings and game_settings.message_limit_per_minute is not None)
                else settings.chat_message_limit_per_minute
            )
            daily = (
                game_settings.daily_message_limit
                if (game_settings and game_settings.daily_message_limit is not None)
                else settings.chat_daily_message_limit
            )
            if max_len and len(message_text) > max_len:
                return (
                    jsonify({"error": f"Message too long (>{settings.chat_message_max_length})"}),
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

        if game_id:
            game = Game.query.filter_by(id=game_id, project_id=project_id).first()
            if not game:
                return jsonify({"error": "Game not found"}), 404
        if loader_id:
            loader = Loader.query.filter_by(id=loader_id, project_id=project_id).first()
            if not loader:
                return jsonify({"error": "Loader not found"}), 404
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
            game_id=game_id,
            loader_id=loader_id,
            group_id=group_id,
        )

        db.session.add(chat_message)
        db.session.commit()

        telegram_bot = TelegramBot.query.filter_by(project_id=project_id, is_active=True).first()

        game_settings = None
        if game_id:
            game_settings = GameChatSettings.query.filter_by(
                game_id=game_id, project_id=project_id
            ).first()

        telegram_allowed = "telegram" in platforms_set
        discord_allowed = "discord" in platforms_set
        if game_settings:
            if not game_settings.telegram_enabled:
                telegram_allowed = False
            if not game_settings.discord_enabled:
                discord_allowed = False

        if telegram_bot and telegram_allowed:
            sender_name = (
                user.username
                if user.username
                else f"{RBACManager.get_user_role_names(user)[0] if RBACManager.get_user_role_names(user) else "client".title()} ({user.id})"
            )
            formatted_message = bot_manager.format_message(sender_type, sender_name, message_text)

            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                telegram_message_id = loop.run_until_complete(
                    bot_manager.send_message(
                        telegram_bot.bot_token, telegram_bot.chat_id, formatted_message
                    )
                )

                if telegram_message_id:
                    chat_message.telegram_message_id = str(telegram_message_id)
                    chat_message.is_sent_to_telegram = True
                    db.session.commit()

                loop.close()
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
            "game_id": chat_message.game_id,
            "loader_id": chat_message.loader_id,
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

        if existing_bot:
            existing_bot.bot_token = bot_token
            existing_bot.chat_id = chat_id
            existing_bot.updated_at = datetime.utcnow()

            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                bot = telegram.Bot(token=bot_token)
                bot_info = loop.run_until_complete(bot.get_me())
                existing_bot.bot_username = bot_info.username
                loop.close()
            except Exception as e:
                logger.error(f"Error getting bot info: {e}")
                existing_bot.bot_username = None
        else:
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                bot = telegram.Bot(token=bot_token)
                bot_info = loop.run_until_complete(bot.get_me())
                bot_username = bot_info.username
                loop.close()
            except Exception as e:
                logger.error(f"Error getting bot info: {e}")
                return jsonify({"error": "Invalid bot token"}), 400

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
        game_id = data.get("game_id")
        loader_id = data.get("loader_id")
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

        settings = ProjectSettings.query.filter_by(project_id=project.id).first()
        if settings:
            if (
                settings.chat_message_max_length
                and len(message_text) > settings.chat_message_max_length
            ):
                return (
                    jsonify({"error": f"Message too long (>{settings.chat_message_max_length})"}),
                    400,
                )
            if (
                settings.chat_message_limit_per_minute
                and settings.chat_message_limit_per_minute > 0
            ):
                since = datetime.utcnow() - timedelta(minutes=1)
                recent_count = ChatMessage.query.filter(
                    ChatMessage.project_id == project.id, ChatMessage.created_at >= since
                ).count()
                if recent_count >= settings.chat_message_limit_per_minute:
                    return jsonify({"error": "Rate limit exceeded (per minute)"}), 429
            if settings.chat_daily_message_limit and settings.chat_daily_message_limit > 0:
                start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
                daily_count = ChatMessage.query.filter(
                    ChatMessage.project_id == project.id, ChatMessage.created_at >= start_of_day
                ).count()
                if daily_count >= settings.chat_daily_message_limit:
                    return jsonify({"error": "Daily message limit reached"}), 429

        if game_id:
            game = Game.query.filter_by(id=game_id, project_id=project.id).first()
            if not game:
                return jsonify({"error": "Game not found"}), 404
        if loader_id:
            loader = Loader.query.filter_by(id=loader_id, project_id=project.id).first()
            if not loader:
                return jsonify({"error": "Loader not found"}), 404
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
            game_id=game_id,
            loader_id=loader_id,
            group_id=group_id,
        )

        db.session.add(chat_message)
        db.session.commit()

        telegram_bot = TelegramBot.query.filter_by(project_id=project.id, is_active=True).first()

        if telegram_bot and ("telegram" in platforms_set):
            sender_name = f"Client ({client_key[-4:]})"
            formatted_message = bot_manager.format_message("client", sender_name, message_text)

            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                telegram_message_id = loop.run_until_complete(
                    bot_manager.send_message(
                        telegram_bot.bot_token, telegram_bot.chat_id, formatted_message
                    )
                )

                if telegram_message_id:
                    chat_message.telegram_message_id = str(telegram_message_id)
                    chat_message.is_sent_to_telegram = True
                    db.session.commit()

                loop.close()
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

@chat_bp.route("/games/<int:game_id>/settings", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_game_chat_settings(game_id: int):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
            return jsonify({"error": "User not found"}), 404
        project_id = getattr(g, "project_id", user.project_id)
        game = Game.query.filter_by(id=game_id, project_id=project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404
        s = GameChatSettings.query.filter_by(game_id=game_id, project_id=project_id).first()
        if not s:

            ps = ProjectSettings.query.filter_by(project_id=project_id).first()
            return jsonify(
                {
                    "telegram_enabled": True,
                    "discord_enabled": True,
                    "message_limit_per_minute": None,
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
        logger.error(f"Error getting game chat settings: {e}")
        return jsonify({"error": "Internal server error"}), 500

@chat_bp.route("/games/<int:game_id>/settings", methods=["PUT"])
@jwt_required()
@enforce_project_scope
def update_game_chat_settings(game_id: int):
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
        game = Game.query.filter_by(id=game_id, project_id=project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404
        data = request.get_json()
        s = GameChatSettings.query.filter_by(game_id=game_id, project_id=project_id).first()
        if not s:
            s = GameChatSettings(game_id=game_id, project_id=project_id)
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
        return jsonify({"message": "Game chat settings updated"})
    except Exception as e:
        logger.error(f"Error updating game chat settings: {e}")
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
        settings = ProjectSettings.query.filter_by(project_id=project_id).first()
        if not settings:

            settings = ProjectSettings(project_id=project_id)
            db.session.add(settings)
            db.session.commit()
        return jsonify(
            {
                "chat_message_limit_per_minute": settings.chat_message_limit_per_minute,
                "chat_daily_message_limit": settings.chat_daily_message_limit,
                "chat_message_max_length": settings.chat_message_max_length,
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
        settings = ProjectSettings.query.filter_by(project_id=project_id).first()
        if not settings:
            settings = ProjectSettings(project_id=project_id)
            db.session.add(settings)
        if "chat_message_limit_per_minute" in data:
            settings.chat_message_limit_per_minute = int(
                data.get("chat_message_limit_per_minute") or 0
            )
        if "chat_daily_message_limit" in data:
            settings.chat_daily_message_limit = int(data.get("chat_daily_message_limit") or 0)
        if "chat_message_max_length" in data:
            settings.chat_message_max_length = int(data.get("chat_message_max_length") or 0)
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
        game_ids = data.get("game_ids") or []

        if not name:
            return jsonify({"error": "Name is required"}), 400

        project_id = getattr(g, "project_id", user.project_id)
        group = ChatGroup(project_id=project_id, name=name, description=description)
        db.session.add(group)
        db.session.flush()

        valid_games = (
            Game.query.filter(Game.id.in_(game_ids), Game.project_id == project_id).all()
            if game_ids
            else []
        )
        for game in valid_games:
            db.session.add(ChatGroupGame(group_id=group.id, game_id=game.id, project_id=project_id))

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
        if "game_ids" in data:

            ChatGroupGame.query.filter_by(group_id=group.id).delete()
            game_ids = data.get("game_ids") or []
            valid_games = (
                Game.query.filter(Game.id.in_(game_ids), Game.project_id == project_id).all()
                if game_ids
                else []
            )
            for game in valid_games:
                db.session.add(
                    ChatGroupGame(group_id=group.id, game_id=game.id, project_id=project_id)
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

        ChatGroupGame.query.filter_by(group_id=group.id).delete()
        db.session.delete(group)
        db.session.commit()
        return jsonify({"message": "Group deleted"})

    except Exception as e:
        logger.error(f"Error deleting group: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500
