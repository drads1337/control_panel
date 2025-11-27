"""
Webhook Execution Service
Handles sending webhooks to external systems (Telegram, Discord, Custom)
"""

import json
import logging
import time
import uuid
from datetime import datetime
from typing import Dict, Optional, Tuple

import requests

from ...core.extensions import db
from ...models.webhooks import WebhookPendingTask
from ...utils.service_helpers import get_service

# Try to import Celery task for webhook processing
try:
    from ...tasks.webhook_tasks import process_webhook as celery_process_webhook
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    celery_process_webhook = None
    logging.warning("Celery webhook tasks not available. Webhooks will use fallback mode.")


class WebhookExecutionService:
    """Service for executing webhook deliveries"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.max_retries = 3
        self.retry_delay = 5
        self.timeout = 10

    def trigger_webhook(self, event: str, data: Dict, project_id: Optional[int] = None) -> bool:
        """Trigger webhooks for a specific event"""
        try:
            from ...models.webhooks import Webhook

            if project_id is None:
                self.logger.warning(
                    f"WEBHOOK_TRIGGER_BLOCKED: project_id is None for event={event} - webhook not triggered for security"
                )
                return False

            # Get active webhooks
            all_webhooks = Webhook.query.filter_by(project_id=project_id, is_active=True).all()
            
            # Filter by event
            webhooks = [
                w for w in all_webhooks
                if f'"{event}"' in (w.events or "")
            ]

            if not webhooks:
                self.logger.info(f"WEBHOOK_NO_WEBHOOKS_FOUND event={event} project_id={project_id}")
                return True

            for webhook in webhooks:
                webhook_data = {
                    "webhook_id": webhook.id,
                    "event": event,
                    "data": data,
                    "webhook_type": webhook.webhook_type,
                    "url": webhook.url,
                    "secret": webhook.secret,
                    "headers": json.loads(webhook.headers or "{}"),
                    "project_id": webhook.project_id,
                    "telegram_bot_token": webhook.telegram_bot_token,
                    "telegram_chat_id": webhook.telegram_chat_id,
                    "discord_webhook_url": webhook.discord_webhook_url,
                    "discord_bot_token": webhook.discord_bot_token,
                    "discord_channel_id": webhook.discord_channel_id,
                    "message_template": webhook.message_template,
                }

                # Use Celery task for async webhook processing
                if CELERY_AVAILABLE and celery_process_webhook:
                    try:
                        celery_process_webhook.delay(webhook_data)
                        self.logger.debug(f"WEBHOOK_QUEUED webhook_id={webhook.id} event={event} via Celery")
                    except Exception as e:
                        self.logger.error(f"WEBHOOK_CELERY_ERROR webhook_id={webhook.id} error={e}")
                        # If Celery fails, store task in database for later processing
                        pending_task_service = get_service('webhook_pending_task_service')
                        pending_task_service.store_pending_webhook_task(
                            webhook.id, project_id, event, webhook_data, str(e)
                        )
                else:
                    # If Celery is not available, store task in database for later processing
                    self.logger.warning(f"Celery not available, storing webhook task in database for later processing (webhook_id={webhook.id})")
                    pending_task_service = get_service('webhook_pending_task_service')
                    pending_task_service.store_pending_webhook_task(
                        webhook.id, project_id, event, webhook_data, "Celery not available"
                    )

            self.logger.info(
                f"WEBHOOK_TRIGGERED event={event} project_id={project_id} webhook_count={len(webhooks)}"
            )
            return True

        except Exception as e:
            self.logger.error(f"WEBHOOK_TRIGGER_ERROR event={event} project_id={project_id} error={e}")
            return False

    def send_telegram_message(self, webhook_data: Dict) -> Tuple[bool, Optional[str]]:
        """Send message to Telegram"""
        try:
            from .webhook_formatting_service import webhook_formatting_service

            bot_token = webhook_data["telegram_bot_token"]
            chat_id = webhook_data["telegram_chat_id"]
            event = webhook_data["event"]
            data = webhook_data["data"]

            message_template = webhook_data.get("message_template")
            message = webhook_formatting_service.format_telegram_message(event, data, message_template)

            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML",
            }

            error_message = None
            for attempt in range(self.max_retries):
                try:
                    response = requests.post(url, json=payload, timeout=self.timeout)

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

                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))

            return False, error_message

        except Exception as e:
            return False, str(e)

    def send_discord_message(self, webhook_data: Dict) -> Tuple[bool, Optional[str]]:
        """Send message to Discord"""
        try:
            from .webhook_formatting_service import webhook_formatting_service

            webhook_url = webhook_data.get("discord_webhook_url")
            bot_token = webhook_data.get("discord_bot_token")
            channel_id = webhook_data.get("discord_channel_id")
            event = webhook_data["event"]
            data = webhook_data["data"]

            embed = webhook_formatting_service.format_discord_embed(event, data)

            if webhook_url:
                url = webhook_url
                payload = {"embeds": [embed]}
                headers = None
            elif bot_token and channel_id:
                url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
                headers = {"Authorization": f"Bot {bot_token}"}
                payload = {"embeds": [embed]}
            else:
                return False, "No Discord webhook URL or bot token provided"

            error_message = None
            for attempt in range(self.max_retries):
                try:
                    if webhook_url:
                        response = requests.post(url, json=payload, timeout=self.timeout)
                    else:
                        response = requests.post(
                            url, json=payload, headers=headers, timeout=self.timeout
                        )

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

                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))

            return False, error_message

        except Exception as e:
            return False, str(e)

    def send_custom_webhook(self, webhook_data: Dict) -> Tuple[bool, Optional[str]]:
        """Send custom webhook"""
        try:
            from .webhook_crypto_service import webhook_crypto_service

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
                signature = webhook_crypto_service.generate_signature(json.dumps(payload), secret)
                headers["X-Webhook-Signature"] = f"sha256={signature}"

            headers["Content-Type"] = "application/json"

            error_message = None
            for attempt in range(self.max_retries):
                try:
                    response = requests.post(
                        url, json=payload, headers=headers, timeout=self.timeout
                    )

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

                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))

            return False, error_message

        except Exception as e:
            return False, str(e)


webhook_execution_service = WebhookExecutionService()

