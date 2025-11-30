"""
Celery tasks for chat message processing
Handles Telegram and Discord message sending asynchronously

REFACTORED: Now uses celery_db_session context manager for safe database session management.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional

try:
    from celery import Task

    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

    class Task:
        pass

from ...utils.celery_db_session import celery_db_session
from ..models.chat import ChatMessage, DiscordWebhook, TelegramBot

logger = logging.getLogger(__name__)

if CELERY_AVAILABLE:
    try:
        from ..core.celery_app import celery_app
    except ImportError:
        celery_app = None
        logger.warning("Celery app not available")
else:
    celery_app = None


def task_decorator(*args, **kwargs):
    """Conditional task decorator - only applies if Celery is available"""
    if CELERY_AVAILABLE and celery_app:
        return celery_app.task(*args, **kwargs)
    else:

        def decorator(func):
            return func

        return decorator


def _send_telegram_message_task(
    bot_token: str, chat_id: str, message: str, chat_message_id: Optional[int] = None
) -> tuple[bool, Optional[str], Optional[int]]:
    """
    Send message to Telegram using synchronous HTTP API
    
    Args:
        bot_token: Telegram bot token
        chat_id: Telegram chat ID
        message: Message text
        chat_message_id: Optional chat message ID to update after sending
        
    Returns:
        Tuple of (success, error_message, telegram_message_id)
    """
    try:
        import requests

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML",
        }

        timeout = 10
        response = requests.post(url, json=payload, timeout=timeout)

        if response.status_code == 200:
            result = response.json()
            if result.get("ok"):
                telegram_message_id = result.get("result", {}).get("message_id")
                return True, None, telegram_message_id
            else:
                return False, f"Telegram API error: {result.get('description', 'Unknown error')}", None
        else:
            return False, f"Telegram API error: HTTP {response.status_code} - {response.text}", None

    except requests.exceptions.Timeout:
        return False, "Request timeout", None
    except requests.exceptions.ConnectionError:
        return False, "Connection error", None
    except Exception as e:
        logger.error(f"Error sending message to Telegram: {e}")
        return False, str(e), None


def _send_discord_message_task(
    webhook_url: str, message_content: str
) -> tuple[bool, Optional[str]]:
    """
    Send message to Discord webhook
    
    Args:
        webhook_url: Discord webhook URL
        message_content: Message content
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        import requests

        payload = {"content": message_content}
        timeout = 5

        response = requests.post(webhook_url, json=payload, timeout=timeout)

        if response.status_code in [200, 201, 204]:
            return True, None
        else:
            return False, f"Discord API error: HTTP {response.status_code} - {response.text}"

    except requests.exceptions.Timeout:
        return False, "Request timeout"
    except requests.exceptions.ConnectionError:
        return False, "Connection error"
    except Exception as e:
        logger.error(f"Error sending message to Discord: {e}")
        return False, str(e)


@task_decorator(
    bind=True,
    name="backend.tasks.chat_tasks.send_telegram_message",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def send_telegram_message_task(
    self, bot_token: str, chat_id: str, message: str, chat_message_id: Optional[int] = None, project_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Send Telegram message asynchronously via Celery.
    
    Args:
        bot_token: Telegram bot token
        chat_id: Telegram chat ID
        message: Message text
        chat_message_id: Optional chat message ID to update after sending
        project_id: Optional project ID for logging
        
    Returns:
        Dictionary with success status and error message if any
    """
    try:
        success, error_message, telegram_message_id = _send_telegram_message_task(
            bot_token, chat_id, message, chat_message_id
        )


        if chat_message_id:
            try:
                with celery_db_session() as session:
                    chat_message = session.query(ChatMessage).filter_by(id=chat_message_id).first()
                    if chat_message:
                        if success and telegram_message_id:
                            chat_message.telegram_message_id = str(telegram_message_id)
                            chat_message.is_sent_to_telegram = True
                        else:

                            chat_message.is_sent_to_telegram = False

                        session.commit()

            except Exception as e:
                logger.error(f"Error updating chat message {chat_message_id}: {e}", exc_info=True)

        logger.info(
            f"TELEGRAM_MESSAGE_SENT chat_message_id={chat_message_id} project_id={project_id} "
            f"success={success} error={error_message}"
        )

        return {"success": success, "error_message": error_message, "telegram_message_id": telegram_message_id}

    except Exception as e:
        logger.error(f"TELEGRAM_MESSAGE_ERROR: {e}", exc_info=True)
        raise


@task_decorator(
    bind=True,
    name="backend.tasks.chat_tasks.send_discord_message",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def send_discord_message_task(
    self, webhook_url: str, message_content: str, project_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Send Discord message asynchronously via Celery.
    
    Args:
        webhook_url: Discord webhook URL
        message_content: Message content
        project_id: Optional project ID for logging
        
    Returns:
        Dictionary with success status and error message if any
    """
    try:
        success, error_message = _send_discord_message_task(webhook_url, message_content)

        logger.info(
            f"DISCORD_MESSAGE_SENT project_id={project_id} success={success} error={error_message}"
        )

        return {"success": success, "error_message": error_message}

    except Exception as e:
        logger.error(f"DISCORD_MESSAGE_ERROR: {e}", exc_info=True)
        raise

