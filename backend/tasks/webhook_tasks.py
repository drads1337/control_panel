"""
Celery tasks for webhook processing
Handles webhook notifications asynchronously with proper error handling and retries
"""

import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

try:
    from celery import Task

    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

    class Task:
        pass

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ..config.config import Config
from ..models.core import db
from ..models.webhooks import Webhook, WebhookLog

logger = logging.getLogger(__name__)

if CELERY_AVAILABLE:
    try:
        from ..core.celery_app import celery_app
    except ImportError:
        celery_app = None
        logger.warning("Celery app not available")
else:
    celery_app = None

if CELERY_AVAILABLE and celery_app:
    db_engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
    Session = sessionmaker(bind=db_engine)
else:
    db_engine = None
    Session = None


class DatabaseTask(Task):
    """
    Base task class that provides database session management
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._db_session = None

    def before_start(self, task_id, args, kwargs):
        """Called before task execution"""
        if Session:
            self._db_session = Session()

    def after_return(self, *args, **kwargs):
        """Called after task execution"""
        if self._db_session:
            try:
                self._db_session.commit()
            except:
                self._db_session.rollback()
            finally:
                self._db_session.close()
                self._db_session = None

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails"""
        if self._db_session:
            try:
                self._db_session.rollback()
            finally:
                self._db_session.close()
                self._db_session = None


def task_decorator(*args, **kwargs):
    """Conditional task decorator - only applies if Celery is available"""
    if CELERY_AVAILABLE and celery_app:
        return celery_app.task(*args, **kwargs)
    else:
        # Fallback: return function as-is if Celery is not available
        def decorator(func):
            return func

        return decorator


def _send_custom_webhook(webhook_data: Dict) -> Tuple[bool, Optional[str]]:
    """Send custom webhook"""
    import hashlib
    import hmac
    import uuid

    import requests

    try:
        url = webhook_data["url"]
        secret = webhook_data.get("secret")
        headers = webhook_data.get("headers", {})
        event = webhook_data["event"]
        data = webhook_data["data"]

        payload = {
            "event": event,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
            "id": str(uuid.uuid4()),
        }

        if secret:
            signature = hmac.new(
                secret.encode("utf-8"), json.dumps(payload).encode("utf-8"), hashlib.sha256
            ).hexdigest()
            headers["X-Webhook-Signature"] = f"sha256={signature}"

        headers["Content-Type"] = "application/json"

        max_retries = 3
        retry_delay = 5
        timeout = 10

        for attempt in range(max_retries):
            try:
                response = requests.post(url, json=payload, headers=headers, timeout=timeout)

                if response.status_code in [200, 201, 202, 204]:
                    return True, None
                else:
                    error_message = f"HTTP {response.status_code}: {response.text}"

            except requests.exceptions.Timeout:
                error_message = "Request timeout"
            except requests.exceptions.ConnectionError:
                error_message = "Connection error"
            except Exception as e:
                error_message = str(e)

            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))

        return False, error_message

    except Exception as e:
        return False, str(e)


def _send_telegram_message(webhook_data: Dict) -> Tuple[bool, Optional[str]]:
    """Send message to Telegram"""
    import requests

    try:
        bot_token = webhook_data["telegram_bot_token"]
        chat_id = webhook_data["telegram_chat_id"]
        event = webhook_data["event"]
        data = webhook_data["data"]

        # Format message
        event_names = {
            "key.created": "🔑 New key created",
            "key.activated": "✅ Key activated",
            "key.expired": "⏰ Key expired",
            "key.blocked": "🚫 Key blocked",
            "user.registered": "👤 New user registered",
            "user.login": "🔐 User login",
            "user.logout": "👋 User logout",
        }
        title = event_names.get(event, f"📢 Event: {event}")
        message = f"<b>{title}</b>\n\n"
        message += f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {"chat_id": chat_id, "text": message, "parse_mode": "HTML"}

        max_retries = 3
        retry_delay = 5
        timeout = 10

        for attempt in range(max_retries):
            try:
                response = requests.post(url, json=payload, timeout=timeout)

                if response.status_code == 200:
                    return True, None
                else:
                    error_message = f"HTTP {response.status_code}: {response.text}"

            except requests.exceptions.Timeout:
                error_message = "Request timeout"
            except requests.exceptions.ConnectionError:
                error_message = "Connection error"
            except Exception as e:
                error_message = str(e)

            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))

        return False, error_message

    except Exception as e:
        return False, str(e)


def _send_discord_message(webhook_data: Dict) -> Tuple[bool, Optional[str]]:
    """Send message to Discord"""
    import requests

    try:
        webhook_url = webhook_data.get("discord_webhook_url")
        bot_token = webhook_data.get("discord_bot_token")
        channel_id = webhook_data.get("discord_channel_id")
        event = webhook_data["event"]
        data = webhook_data["data"]

        # Format embed
        embed = {
            "title": f"Event: {event}",
            "color": 0x0099FF,
            "timestamp": datetime.utcnow().isoformat(),
            "fields": [],
        }

        if webhook_url:
            url = webhook_url
            payload = {"embeds": [embed]}
            headers = {}
        elif bot_token and channel_id:
            url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
            headers = {"Authorization": f"Bot {bot_token}"}
            payload = {"embeds": [embed]}
        else:
            return False, "No Discord webhook URL or bot token provided"

        max_retries = 3
        retry_delay = 5
        timeout = 10

        for attempt in range(max_retries):
            try:
                if webhook_url:
                    response = requests.post(url, json=payload, timeout=timeout)
                else:
                    response = requests.post(url, json=payload, headers=headers, timeout=timeout)

                if response.status_code in [200, 201, 204]:
                    return True, None
                else:
                    error_message = f"HTTP {response.status_code}: {response.text}"

            except requests.exceptions.Timeout:
                error_message = "Request timeout"
            except requests.exceptions.ConnectionError:
                error_message = "Connection error"
            except Exception as e:
                error_message = str(e)

            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))

        return False, error_message

    except Exception as e:
        return False, str(e)


@task_decorator(
    bind=True,
    base=DatabaseTask,
    name="backend.tasks.webhook_tasks.process_webhook",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def process_webhook(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a webhook request asynchronously via Celery.
    
    Args:
        webhook_data: Dictionary containing webhook information:
            - webhook_id: Webhook ID
            - event: Event name
            - data: Event data
            - webhook_type: Type of webhook (custom, telegram, discord)
            - url: Webhook URL (for custom)
            - secret: Webhook secret (for custom)
            - headers: Custom headers (for custom)
            - telegram_bot_token: Telegram bot token (for telegram)
            - telegram_chat_id: Telegram chat ID (for telegram)
            - discord_webhook_url: Discord webhook URL (for discord)
            - discord_bot_token: Discord bot token (for discord)
            - discord_channel_id: Discord channel ID (for discord)
            
    Returns:
        Dictionary with success status and error message if any
    """
    try:
        webhook_id = webhook_data["webhook_id"]
        event = webhook_data["event"]
        data = webhook_data["data"]
        webhook_type = webhook_data.get("webhook_type", "custom")

        success = False
        error_message = None

        # Send webhook based on type
        if webhook_type == "telegram":
            success, error_message = _send_telegram_message(webhook_data)
        elif webhook_type == "discord":
            success, error_message = _send_discord_message(webhook_data)
        else:
            success, error_message = _send_custom_webhook(webhook_data)

        # Log webhook result
        try:
            if self._db_session:
                session = self._db_session
            else:
                session = Session()

            log_entry = WebhookLog(
                webhook_id=webhook_id,
                event=event,
                success=success,
                error_message=error_message,
                payload=json.dumps(data),
                created_at=datetime.utcnow(),
            )

            session.add(log_entry)

            # Update webhook statistics
            webhook = session.query(Webhook).filter_by(id=webhook_id).first()
            if webhook:
                if success:
                    webhook.success_count += 1
                else:
                    webhook.failure_count += 1
                webhook.last_triggered = datetime.utcnow()

            session.commit()

            if not self._db_session:
                session.close()

        except Exception as e:
            logger.error(f"WEBHOOK_LOG_ERROR webhook_id={webhook_id} error={e}")
            if self._db_session:
                self._db_session.rollback()
            else:
                if session:
                    session.rollback()
                    session.close()

        logger.info(
            f"WEBHOOK_PROCESSED webhook_id={webhook_id} event={event} success={success} "
            f"error={error_message}"
        )

        return {"success": success, "error_message": error_message}

    except Exception as e:
        logger.error(f"WEBHOOK_PROCESSING_ERROR: {e}", exc_info=True)
        raise

