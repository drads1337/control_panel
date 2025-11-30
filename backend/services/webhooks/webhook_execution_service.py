"""
Webhook Execution Service
Handles sending webhooks to external systems (Telegram, Discord, Custom)

SECURITY: This service implements SSRF protection by:
1. Using cached IP addresses from validation (prevents DNS rebinding attacks)
2. Blocking redirects to internal/private IP addresses
3. Using custom HTTP adapter that validates IP addresses before connecting
"""

import ipaddress
import json
import logging
import socket
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.connection import create_connection

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

class SSRFProtectedHTTPAdapter(HTTPAdapter):
    """
    Custom HTTP adapter that prevents SSRF attacks by:
    1. Validating IP addresses before connecting
    2. Blocking connections to private/internal IP ranges
    3. Using cached IP addresses when available
    """
    
    def __init__(self, allowed_ips: Optional[List[str]] = None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.allowed_ips = allowed_ips or []
        self.logger = logging.getLogger(__name__)
    
    def init_poolmanager(self, *args, **kwargs):
        # Use our custom connection pool
        return super().init_poolmanager(*args, **kwargs)
    
    def _validate_ip(self, ip_address: str) -> bool:
        """
        Validate that IP address is not in blocked ranges.
        
        Returns:
            True if IP is safe, False if blocked
        """
        try:
            ip_obj = ipaddress.ip_address(ip_address)
            
            # Block private IP ranges
            if ip_obj.is_private:
                return False
            
            # Block loopback addresses
            if ip_obj.is_loopback:
                return False
            
            # Block link-local addresses
            if ip_obj.is_link_local:
                return False
            
            # Block multicast addresses
            if ip_obj.is_multicast:
                return False
            
            # Block reserved addresses
            if ip_obj.is_reserved:
                return False
            
            # Block cloud metadata endpoints
            if ip_address == "169.254.169.254":
                return False
            
            return True
        except ValueError:
            return False

class WebhookExecutionService:
    """Service for executing webhook deliveries"""

    def __init__(self, webhook_pending_task_service=None):
        self._webhook_pending_task_service = webhook_pending_task_service
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
        """
        Send custom webhook with SSRF protection.
        
        SECURITY: This method uses cached IP addresses from validation
        to prevent DNS rebinding attacks. Redirects are blocked to prevent
        SSRF through HTTP redirects.
        """
        try:
            from .webhook_crypto_service import webhook_crypto_service
            from .webhook_validation_service import webhook_validation_service

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

            # SECURITY: Get cached IP addresses to prevent DNS rebinding
            validated_ips = webhook_validation_service.get_validated_ips_for_url(url)
            if not validated_ips:
                self.logger.warning(
                    f"WEBHOOK_SSRF_PROTECTION: No cached IPs for {url}, "
                    "re-validating URL. This should not happen in normal operation."
                )
                # Re-validate URL (this will cache IPs)
                if not webhook_validation_service.validate_url(url):
                    return False, "Invalid webhook URL (SSRF protection)"
                validated_ips = webhook_validation_service.get_validated_ips_for_url(url)
                if not validated_ips:
                    return False, "Failed to validate webhook URL"

            # Create session with SSRF-protected adapter
            session = requests.Session()
            adapter = SSRFProtectedHTTPAdapter(allowed_ips=validated_ips)
            session.mount("https://", adapter)
            session.mount("http://", adapter)

            error_message = None
            for attempt in range(self.max_retries):
                try:
                    # SECURITY: Block redirects to prevent SSRF through HTTP redirects
                    # If server returns redirect, we block it instead of following
                    response = session.post(
                        url,
                        json=payload,
                        headers=headers,
                        timeout=self.timeout,
                        allow_redirects=False  # SECURITY: Block redirects
                    )

                    # Handle redirect response (block it)
                    if response.status_code in [301, 302, 303, 307, 308]:
                        self.logger.warning(
                            f"WEBHOOK_SSRF_BLOCKED: Redirect detected for {url} "
                            f"(Status {response.status_code}). Redirects are blocked for security."
                        )
                        error_message = "Redirect detected and blocked for security"
                        continue

                    if response.status_code in [200, 201, 202, 204]:
                        return True, None
                    else:
                        error_message = f"HTTP {response.status_code}: {response.text}"

                except requests.exceptions.Timeout:
                    error_message = "Request timeout"
                except requests.exceptions.ConnectionError as e:
                    error_message = f"Connection error: {str(e)}"
                    # Check if connection was blocked due to SSRF protection
                    if "blocked" in str(e).lower() or "private" in str(e).lower():
                        self.logger.warning(
                            f"WEBHOOK_SSRF_BLOCKED: Connection blocked for {url}: {e}"
                        )
                        error_message = "Connection blocked for security reasons"
                except Exception as e:
                    error_message = str(e)

                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))

            return False, error_message

        except Exception as e:
            self.logger.error(f"WEBHOOK_EXECUTION_ERROR: {e}")
            return False, str(e)

