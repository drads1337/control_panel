"""
Webhook Service
Manages webhook notifications to external systems
"""

import hashlib
import hmac
import ipaddress
import json
import logging
import socket
import time
import traceback
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests
from flask import current_app

from ...core.extensions import db
from ...models.core import Project, User
from ...models.products import Product
from ...models.keys import Key
from ...models.webhooks import Webhook, WebhookLog
from ...utils.data_masking import mask_key

# Try to import Celery task for webhook processing
try:
    from ...tasks.webhook_tasks import process_webhook as celery_process_webhook
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    celery_process_webhook = None
    logging.warning("Celery webhook tasks not available. Webhooks will use fallback mode.")

class WebhookService:
    """Service for managing webhook notifications"""

    def __init__(self):
        self.max_retries = 3
        self.retry_delay = 5
        self.timeout = 10

    def create_webhook(
        self,
        project_id: int,
        name: str,
        webhook_type: str = "custom",
        url: Optional[str] = None,
        events: List[str] = None,
        secret: Optional[str] = None,
        is_active: bool = True,
        headers: Optional[Dict] = None,

        telegram_bot_token: Optional[str] = None,
        telegram_chat_id: Optional[str] = None,

        discord_webhook_url: Optional[str] = None,
        discord_bot_token: Optional[str] = None,
        discord_channel_id: Optional[str] = None,
    ) -> Dict:
        """Create a new webhook"""
        try:

            if webhook_type == "custom":
                if not url or not self._validate_url(url):
                    raise ValueError("Invalid webhook URL for custom type")
            elif webhook_type == "telegram":
                if not telegram_bot_token or not telegram_chat_id:
                    raise ValueError("Telegram bot token and chat ID/username are required")
            elif webhook_type == "discord":
                if not discord_webhook_url and not (discord_bot_token and discord_channel_id):
                    raise ValueError(
                        "Discord webhook URL or bot token with channel ID are required"
                    )
            else:
                raise ValueError(f"Invalid webhook type: {webhook_type}")

            if events:
                valid_events = self._get_valid_events()
                for event in events:
                    if event not in valid_events:
                        raise ValueError(f"Invalid event: {event}")
            else:
                events = []

            if not secret:
                secret = self._generate_secret()

            webhook = Webhook(
                project_id=project_id,
                name=name,
                webhook_type=webhook_type,
                url=url,
                events=json.dumps(events),
                secret=secret,
                is_active=is_active,
                headers=json.dumps(headers or {}),
                telegram_bot_token=telegram_bot_token,
                telegram_chat_id=telegram_chat_id,
                discord_webhook_url=discord_webhook_url,
                discord_bot_token=discord_bot_token,
                discord_channel_id=discord_channel_id,
                created_at=datetime.utcnow(),
            )

            db.session.add(webhook)
            db.session.commit()

            logging.info(
                f"WEBHOOK_CREATED webhook_id={webhook.id} project_id={project_id} name={name}"
            )

            return {
                "id": webhook.id,
                "name": webhook.name,
                "url": webhook.url,
                "events": events,
                "secret": webhook.secret,
                "is_active": webhook.is_active,
                "created_at": webhook.created_at.isoformat(),
            }

        except Exception as e:
            db.session.rollback()
            logging.error(f"WEBHOOK_CREATION_ERROR project_id={project_id} error={e}")
            raise ValueError(f"Failed to create webhook: {str(e)}")

    def update_webhook(self, webhook_id: int, project_id: Optional[int] = None, **kwargs) -> Dict:
        """Update an existing webhook"""
        try:
            # Get webhook
            if project_id:
                webhook = Webhook.query.filter_by(id=webhook_id, project_id=project_id).first()
            else:
                # Fallback for backward compatibility
                webhook = Webhook.query.filter_by(id=webhook_id).first()
            
            if not webhook:
                raise ValueError("Webhook not found")

            if "name" in kwargs:
                webhook.name = kwargs["name"]

            if "url" in kwargs:
                if not self._validate_url(kwargs["url"]):
                    raise ValueError("Invalid webhook URL")
                webhook.url = kwargs["url"]

            if "events" in kwargs:
                valid_events = self._get_valid_events()
                for event in kwargs["events"]:
                    if event not in valid_events:
                        raise ValueError(f"Invalid event: {event}")
                webhook.events = json.dumps(kwargs["events"])

            if "secret" in kwargs:
                webhook.secret = kwargs["secret"]

            if "is_active" in kwargs:
                webhook.is_active = kwargs["is_active"]

            if "headers" in kwargs:
                webhook.headers = json.dumps(kwargs["headers"])

            webhook.updated_at = datetime.utcnow()

            db.session.commit()

            logging.info(f"WEBHOOK_UPDATED webhook_id={webhook_id}")

            return {
                "id": webhook.id,
                "name": webhook.name,
                "url": webhook.url,
                "events": json.loads(webhook.events),
                "secret": webhook.secret,
                "is_active": webhook.is_active,
                "updated_at": webhook.updated_at.isoformat(),
            }

        except Exception as e:
            db.session.rollback()
            logging.error(f"WEBHOOK_UPDATE_ERROR webhook_id={webhook_id} error={e}")
            raise ValueError(f"Failed to update webhook: {str(e)}")

    def delete_webhook(self, webhook_id: int, project_id: Optional[int] = None) -> bool:
        """Delete a webhook"""
        try:
            # Get webhook
            if project_id:
                webhook = Webhook.query.filter_by(id=webhook_id, project_id=project_id).first()
            else:
                # Fallback for backward compatibility
                webhook = Webhook.query.filter_by(id=webhook_id).first()
            
            if not webhook:
                return False

            WebhookLog.query.filter_by(webhook_id=webhook_id).delete()

            db.session.delete(webhook)
            db.session.commit()

            logging.info(f"WEBHOOK_DELETED webhook_id={webhook_id}")
            return True

        except Exception as e:
            db.session.rollback()
            logging.error(f"WEBHOOK_DELETION_ERROR webhook_id={webhook_id} error={e}")
            return False

    def get_webhooks(self, project_id: Optional[int] = None) -> List[Dict]:
        """
        Get webhooks for a project
        
        SECURITY: Sensitive data (tokens, secrets) are masked in GET responses
        to prevent XSS attacks from exposing credentials. Full values are only
        returned when explicitly needed (e.g., during webhook execution).
        """
        try:
            # Get webhooks
            if project_id:
                webhooks = Webhook.query.filter_by(project_id=project_id).order_by(Webhook.created_at.desc()).all()
            else:
                # Fallback for backward compatibility
                webhooks = Webhook.query.order_by(Webhook.created_at.desc()).all()

            return [
                {
                    "id": webhook.id,
                    "project_id": webhook.project_id,
                    "name": webhook.name,
                    "webhook_type": webhook.webhook_type,
                    "url": webhook.url,
                    "events": json.loads(webhook.events),
                    # SECURITY: Mask secret to prevent XSS exposure
                    "secret": mask_key(webhook.secret) if webhook.secret else None,
                    "is_active": webhook.is_active,
                    "headers": json.loads(webhook.headers or "{}"),

                    # SECURITY: Mask tokens to prevent XSS exposure
                    "telegram_bot_token": mask_key(webhook.telegram_bot_token) if webhook.telegram_bot_token else None,
                    "telegram_chat_id": webhook.telegram_chat_id,

                    "discord_webhook_url": webhook.discord_webhook_url,
                    # SECURITY: Mask bot token to prevent XSS exposure
                    "discord_bot_token": mask_key(webhook.discord_bot_token) if webhook.discord_bot_token else None,
                    "discord_channel_id": webhook.discord_channel_id,
                    "created_at": webhook.created_at.isoformat(),
                    "updated_at": webhook.updated_at.isoformat() if webhook.updated_at else None,
                    "last_triggered": (
                        webhook.last_triggered.isoformat() if webhook.last_triggered else None
                    ),
                    "success_count": webhook.success_count,
                    "failure_count": webhook.failure_count,
                }
                for webhook in webhooks
            ]

        except Exception as e:
            logging.error(f"WEBHOOK_GET_ERROR project_id={project_id} error={e}")
            return []

    def trigger_webhook(self, event: str, data: Dict, project_id: Optional[int] = None) -> bool:
        """Trigger webhooks for a specific event"""
        try:

            if project_id is None:
                logging.warning(
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
                logging.info(f"WEBHOOK_NO_WEBHOOKS_FOUND event={event} project_id={project_id}")
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
                        logging.debug(f"WEBHOOK_QUEUED webhook_id={webhook.id} event={event} via Celery")
                    except Exception as e:
                        logging.error(f"WEBHOOK_CELERY_ERROR webhook_id={webhook.id} error={e}")
                        # Fallback to synchronous processing if Celery fails
                        self._process_webhook_sync(webhook_data)
                else:
                    # Fallback to synchronous processing if Celery is not available
                    logging.warning("Celery not available, processing webhook synchronously")
                    self._process_webhook_sync(webhook_data)

            logging.info(
                f"WEBHOOK_TRIGGERED event={event} project_id={project_id} webhook_count={len(webhooks)}"
            )
            return True

        except Exception as e:
            logging.error(f"WEBHOOK_TRIGGER_ERROR event={event} project_id={project_id} error={e}")
            return False

    def _process_webhook_sync(self, webhook_data: Dict):
        """
        Process a webhook request synchronously (fallback when Celery is not available).
        
        NOTE: This is a fallback method. In production, webhooks should be processed
        asynchronously via Celery tasks for better scalability and monitoring.
        """
        try:
            webhook_id = webhook_data["webhook_id"]
            event = webhook_data["event"]
            data = webhook_data["data"]
            webhook_type = webhook_data.get("webhook_type", "custom")

            success = False
            error_message = None

            if webhook_type == "telegram":
                success, error_message = self._send_telegram_message(webhook_data)
            elif webhook_type == "discord":
                success, error_message = self._send_discord_message(webhook_data)
            else:
                success, error_message = self._send_custom_webhook(webhook_data)

            self._log_webhook_result_with_context(webhook_id, event, success, error_message, data)

            self._update_webhook_stats_with_context(webhook_id, success)

        except Exception as e:
            logging.error(f"WEBHOOK_PROCESSING_ERROR: {e}")
            import traceback

            logging.error(f"WEBHOOK_PROCESSING_TRACEBACK: {traceback.format_exc()}")

    def _send_telegram_message(self, webhook_data: Dict) -> Tuple[bool, Optional[str]]:
        """Send message to Telegram"""
        try:
            bot_token = webhook_data["telegram_bot_token"]
            chat_id = webhook_data["telegram_chat_id"]
            event = webhook_data["event"]
            data = webhook_data["data"]

            message_template = webhook_data.get("message_template")
            message = self._format_telegram_message(event, data, message_template)

            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML",
            }

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

    def _send_discord_message(self, webhook_data: Dict) -> Tuple[bool, Optional[str]]:
        """Send message to Discord"""
        try:
            webhook_url = webhook_data.get("discord_webhook_url")
            bot_token = webhook_data.get("discord_bot_token")
            channel_id = webhook_data.get("discord_channel_id")
            event = webhook_data["event"]
            data = webhook_data["data"]

            embed = self._format_discord_embed(event, data)

            if webhook_url:

                url = webhook_url
                payload = {"embeds": [embed]}
            elif bot_token and channel_id:

                url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
                headers = {"Authorization": f"Bot {bot_token}"}
                payload = {"embeds": [embed]}
            else:
                return False, "No Discord webhook URL or bot token provided"

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

    def _send_custom_webhook(self, webhook_data: Dict) -> Tuple[bool, Optional[str]]:
        """Send custom webhook"""
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
                signature = self._generate_signature(json.dumps(payload), secret)
                headers["X-Webhook-Signature"] = f"sha256={signature}"

            headers["Content-Type"] = "product/json"

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

    def _log_webhook_result(
        self,
        webhook_id: int,
        event: str,
        success: bool,
        error_message: Optional[str],
        payload: Dict,
    ):
        """Log webhook result"""
        try:
            log_entry = WebhookLog(
                webhook_id=webhook_id,
                event=event,
                success=success,
                error_message=error_message,
                payload=json.dumps(payload),
                created_at=datetime.utcnow(),
            )

            db.session.add(log_entry)
            db.session.commit()

        except Exception as e:
            logging.error(f"WEBHOOK_LOG_ERROR webhook_id={webhook_id} error={e}")

    def _update_webhook_stats(self, webhook_id: int, success: bool, project_id: Optional[int] = None):
        """Update webhook statistics"""
        try:
            # Get webhook
            if project_id:
                webhook = Webhook.query.filter_by(id=webhook_id, project_id=project_id).first()
            else:
                # Fallback for backward compatibility
                webhook = Webhook.query.filter_by(id=webhook_id).first()
            
            if not webhook:
                return

            if success:
                webhook.success_count += 1
            else:
                webhook.failure_count += 1

            webhook.last_triggered = datetime.utcnow()
            db.session.commit()

        except Exception as e:
            logging.error(f"WEBHOOK_STATS_UPDATE_ERROR webhook_id={webhook_id} error={e}")

    def _log_webhook_result_with_context(
        self,
        webhook_id: int,
        event: str,
        success: bool,
        error_message: Optional[str],
        payload: Dict,
    ):
        """Log webhook result with Flask app context"""
        try:
            from flask import current_app

            app = current_app._get_current_object()

            with app.app_context():
                log_entry = WebhookLog(
                    webhook_id=webhook_id,
                    event=event,
                    success=success,
                    error_message=error_message,
                    payload=json.dumps(payload),
                    created_at=datetime.utcnow(),
                )

                db.session.add(log_entry)
                db.session.commit()

        except Exception as e:
            logging.error(f"WEBHOOK_LOG_ERROR: {e}")

    def _update_webhook_stats_with_context(self, webhook_id: int, success: bool):
        """Update webhook statistics with Flask app context"""
        try:
            from flask import current_app

            app = current_app._get_current_object()

            with app.app_context():
                webhook = Webhook.query.filter_by(id=webhook_id).first()
                if not webhook:
                    return

                if success:
                    webhook.success_count += 1
                else:
                    webhook.failure_count += 1

                webhook.last_triggered = datetime.utcnow()
                db.session.commit()

        except Exception as e:
            logging.error(f"WEBHOOK_STATS_UPDATE_ERROR: {e}")

    def get_webhook_logs(self, webhook_id: int, limit: int = 100) -> List[Dict]:
        """Get webhook logs"""
        try:
            logs = (
                WebhookLog.query.filter_by(webhook_id=webhook_id)
                .order_by(WebhookLog.created_at.desc())
                .limit(limit)
                .all()
            )

            return [
                {
                    "id": log.id,
                    "webhook_id": log.webhook_id,
                    "event": log.event,
                    "success": log.success,
                    "error_message": log.error_message,
                    "payload": json.loads(log.payload),
                    "created_at": log.created_at.isoformat(),
                }
                for log in logs
            ]

        except Exception as e:
            logging.error(f"WEBHOOK_LOGS_ERROR webhook_id={webhook_id} error={e}")
            return []

    def test_webhook(self, webhook_id: int) -> Dict:
        """Test a webhook with a test payload"""
        try:
            webhook = Webhook.query.filter_by(id=webhook_id).first()
            if not webhook:
                raise ValueError("Webhook not found")

            test_data = {
                "test": True,
                "message": "This is a test webhook",
                "timestamp": datetime.utcnow().isoformat(),
            }

            if webhook.webhook_type == "telegram":
                return self._test_telegram_webhook(webhook, test_data)
            elif webhook.webhook_type == "discord":
                return self._test_discord_webhook(webhook, test_data)
            else:

                return self._test_custom_webhook(webhook, test_data)

        except Exception as e:
            logging.error(f"WEBHOOK_TEST_ERROR webhook_id={webhook_id} error={e}")
            return {
                "success": False,
                "status_code": None,
                "response_text": None,
                "error_message": str(e),
            }

    def _test_telegram_webhook(self, webhook: Webhook, test_data: Dict) -> Dict:
        """Test Telegram webhook"""
        try:
            if not webhook.telegram_bot_token or not webhook.telegram_chat_id:
                return {
                    "success": False,
                    "status_code": None,
                    "response_text": None,
                    "error_message": "Telegram bot token and chat ID are required",
                }

            message = self._format_telegram_message("test", test_data, webhook.message_template)

            url = f"https://api.telegram.org/bot{webhook.telegram_bot_token}/sendMessage"
            payload = {"chat_id": webhook.telegram_chat_id, "text": message, "parse_mode": "HTML"}

            response = requests.post(url, json=payload, timeout=self.timeout)
            success = response.status_code == 200

            return {
                "success": success,
                "status_code": response.status_code,
                "response_text": response.text,
                "error_message": (
                    None if success else f"HTTP {response.status_code}: {response.text}"
                ),
            }

        except Exception as e:
            return {
                "success": False,
                "status_code": None,
                "response_text": None,
                "error_message": str(e),
            }

    def _test_discord_webhook(self, webhook: Webhook, test_data: Dict) -> Dict:
        """Test Discord webhook"""
        try:
            webhook_url = webhook.discord_webhook_url
            bot_token = webhook.discord_bot_token
            channel_id = webhook.discord_channel_id

            if not webhook_url and not (bot_token and channel_id):
                return {
                    "success": False,
                    "status_code": None,
                    "response_text": None,
                    "error_message": "Discord webhook URL or bot token with channel ID are required",
                }

            embed = self._format_discord_embed("test", test_data)

            if webhook_url:

                url = webhook_url
                payload = {"embeds": [embed]}
                headers = {}
            else:

                url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
                headers = {"Authorization": f"Bot {bot_token}"}
                payload = {"embeds": [embed]}

            response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            success = response.status_code in [200, 201, 204]

            return {
                "success": success,
                "status_code": response.status_code,
                "response_text": response.text,
                "error_message": (
                    None if success else f"HTTP {response.status_code}: {response.text}"
                ),
            }

        except Exception as e:
            return {
                "success": False,
                "status_code": None,
                "response_text": None,
                "error_message": str(e),
            }

    def _test_custom_webhook(self, webhook: Webhook, test_data: Dict) -> Dict:
        """Test custom webhook"""
        try:
            if not webhook.url:
                return {
                    "success": False,
                    "status_code": None,
                    "response_text": None,
                    "error_message": "Webhook URL is required for custom webhooks",
                }

            payload = {
                "event": "test",
                "data": test_data,
                "timestamp": datetime.utcnow().isoformat(),
                "id": str(uuid.uuid4()),
            }

            headers = json.loads(webhook.headers or "{}")
            if webhook.secret:
                signature = self._generate_signature(json.dumps(payload), webhook.secret)
                headers["X-Webhook-Signature"] = f"sha256={signature}"

            headers["Content-Type"] = "product/json"

            response = requests.post(
                webhook.url, json=payload, headers=headers, timeout=self.timeout
            )

            success = response.status_code in [200, 201, 202, 204]

            return {
                "success": success,
                "status_code": response.status_code,
                "response_text": response.text,
                "error_message": (
                    None if success else f"HTTP {response.status_code}: {response.text}"
                ),
            }

        except Exception as e:
            return {
                "success": False,
                "status_code": None,
                "response_text": None,
                "error_message": str(e),
            }

    def _validate_url(self, url: str) -> bool:
        """
        Validate webhook URL with SSRF protection.
        
        SECURITY: This method protects against SSRF attacks including DNS rebinding.
        Uses getaddrinfo() to resolve all IP addresses and validates each one.
        This prevents TOCTOU (Time-of-check to time-of-use) attacks where DNS
        resolution changes between validation and actual request.
        
        This method:
        1. Only allows HTTPS URLs (not HTTP) for security
        2. Resolves domain to ALL IP addresses (IPv4 and IPv6)
        3. Validates ALL resolved IP addresses against blocked ranges
        4. Blocks localhost, private IP ranges, and internal network addresses
        5. Prevents SSRF attacks on internal services
        
        Args:
            url: URL to validate
            
        Returns:
            True if URL is safe, False otherwise
        """
        try:
            if not url or not url.strip():
                return False

            url = url.strip()
            
            # Parse URL
            parsed = urlparse(url)
            
            # SECURITY: Only allow HTTPS, not HTTP
            if parsed.scheme != "https":
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Only HTTPS allowed, got {parsed.scheme}")
                return False
            
            # Get hostname
            hostname = parsed.hostname
            if not hostname:
                return False
            
            # SECURITY: Block localhost and common local hostnames
            blocked_hostnames = {
                "localhost",
                "127.0.0.1",
                "0.0.0.0",
                "::1",
                "localhost.localdomain",
                "metadata.google.internal",  # GCP metadata
            }
            if hostname.lower() in blocked_hostnames:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Blocked hostname {hostname}")
                return False
            
            # SECURITY: Block IP addresses in URL (should use hostname, not IP)
            # This prevents bypassing DNS resolution checks
            try:
                # Try to parse hostname as IP address
                ipaddress.ip_address(hostname)
                # If successful, hostname is an IP address - block it
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: IP address in URL instead of hostname: {hostname}")
                return False
            except ValueError:
                # Not an IP address, continue validation
                pass
            
            # SECURITY: Resolve hostname to ALL IP addresses (IPv4 and IPv6)
            # Using getaddrinfo() instead of gethostbyname() to:
            # 1. Get all IP addresses (not just first)
            # 2. Support both IPv4 and IPv6
            # 3. Better handle DNS rebinding attacks
            try:
                # Get all address info (IPv4 and IPv6)
                addr_infos = socket.getaddrinfo(hostname, None, 0, socket.SOCK_STREAM)
                if not addr_infos:
                    logging.warning(f"WEBHOOK_SSRF_BLOCKED: No IP addresses found for {hostname}")
                    return False
                
                # Extract all IP addresses
                ip_addresses = []
                for addr_info in addr_infos:
                    ip_addr = addr_info[4][0]  # (hostname, port) tuple, get hostname
                    ip_addresses.append(ip_addr)
                
                # SECURITY: Validate ALL resolved IP addresses
                # If ANY IP is in blocked range, reject the URL
                for ip_address in ip_addresses:
                    try:
                        ip_obj = ipaddress.ip_address(ip_address)
                    except ValueError:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Invalid IP address {ip_address}")
                        return False
                    
                    # SECURITY: Block private IP ranges (RFC 1918)
                    # 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                    if ip_obj.is_private:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Private IP range {ip_address} for {hostname}")
                        return False
                    
                    # SECURITY: Block loopback addresses
                    if ip_obj.is_loopback:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Loopback address {ip_address} for {hostname}")
                        return False
                    
                    # SECURITY: Block link-local addresses (169.254.0.0/16)
                    if ip_obj.is_link_local:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Link-local address {ip_address} for {hostname}")
                        return False
                    
                    # SECURITY: Block multicast addresses
                    if ip_obj.is_multicast:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Multicast address {ip_address} for {hostname}")
                        return False
                    
                    # SECURITY: Block reserved addresses (0.0.0.0/8, etc.)
                    if ip_obj.is_reserved:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Reserved address {ip_address} for {hostname}")
                        return False
                    
                    # SECURITY: Block cloud metadata endpoints (AWS, GCP, Azure)
                    if ip_address == "169.254.169.254":
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Cloud metadata endpoint {ip_address} for {hostname}")
                        return False
                
            except (socket.gaierror, socket.herror, OSError) as e:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Failed to resolve {hostname}: {e}")
                return False
            
            # URL format validation
            import re
            url_pattern = re.compile(
                r"^https://"
                r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"
                r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
                r"(?::\d+)?"
                r"(?:/?|[/?]\S+)$",
                re.IGNORECASE,
            )
            
            if not url_pattern.match(url):
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Invalid URL format {url}")
                return False
            
            logging.debug(f"WEBHOOK_URL_VALIDATED: {hostname} -> {len(ip_addresses)} IP(s) validated")
            return True
            
        except Exception as e:
            logging.error(f"WEBHOOK_URL_VALIDATION_ERROR: {e}")
            return False

    def _generate_secret(self) -> str:
        """Generate a random webhook secret"""
        import secrets

        return secrets.token_urlsafe(32)

    def _generate_signature(self, payload: str, secret: str) -> str:
        """Generate HMAC signature for webhook payload"""
        return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()

    def _format_telegram_message(self, event: str, data: Dict, custom_template: str = None) -> str:
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
                logging.error(f"Error processing custom template: {e}")

        event_names = {
            # Keys
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
            # Connect
            "connect.success": "✅ Client connected",
            "connect.failed": "❌ Connection failed",
            "connect.disconnected": "🔌 Client disconnected",
            "connect.challenge_requested": "🔐 Challenge requested",
            "connect.token_generated": "🎫 Token generated",
            "connect.token_expired": "⏰ Token expired",
            # Users
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
            # Products
            "product.created": "🎮 New product created",
            "product.updated": "📝 Product updated",
            "product.activated": "✅ Product activated",
            "product.deactivated": "❌ Product deactivated",
            "product.deleted": "🗑️ Product deleted",
            "product.file_uploaded": "📤 File uploaded",
            "product.file_downloaded": "📥 File downloaded",
            "product.settings_changed": "⚙️ Settings changed",
            "product.version_updated": "🔄 Version updated",
            # Security
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
            # Agents
            "agent.created": "🤖 Agent created",
            "agent.updated": "📝 Agent updated",
            "agent.deleted": "🗑️ Agent deleted",
            "agent.downloaded": "📥 Agent downloaded",
            "agent.version_updated": "🔄 Version updated",
            "agent.status_changed": "🔄 Status changed",
            "agent.product_assigned": "➕ Product assigned",
            "agent.product_unassigned": "➖ Product unassigned",
            # Servers
            "server.created": "🖥️ Server created",
            "server.updated": "📝 Server updated",
            "server.deleted": "🗑️ Server deleted",
            "server.status_changed": "🔄 Status changed",
            "server.connected": "🔌 Server connected",
            "server.disconnected": "🔌 Server disconnected",
            # Remote Control
            "remote.feature_enabled": "✅ Feature enabled",
            "remote.feature_disabled": "❌ Feature disabled",
            "remote.feature_updated": "📝 Feature updated",
            "remote.category_created": "📁 Category created",
            "remote.category_updated": "📝 Category updated",
            "remote.category_deleted": "🗑️ Category deleted",
            # Notifications
            "notification.created": "📢 Notification created",
            "notification.sent": "📤 Notification sent",
            "notification.read": "👁️ Notification read",
            # RBAC
            "rbac.role_created": "👑 Role created",
            "rbac.role_updated": "📝 Role updated",
            "rbac.role_deleted": "🗑️ Role deleted",
            "rbac.permission_granted": "✅ Permission granted",
            "rbac.permission_revoked": "❌ Permission revoked",
            "rbac.user_role_assigned": "➕ Role assigned",
            "rbac.user_role_removed": "➖ Role removed",
            # Billing & Payments
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

    def _format_discord_embed(self, event: str, data: Dict) -> Dict:
        """Format embed for Discord"""
        event_info = {
            # Keys
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
            # Connect
            "connect.success": {"title": "✅ Client connected", "color": 0x00FF00},
            "connect.failed": {"title": "❌ Connection failed", "color": 0xFF0000},
            "connect.disconnected": {"title": "🔌 Client disconnected", "color": 0xFFAA00},
            "connect.challenge_requested": {"title": "🔐 Challenge requested", "color": 0x0099FF},
            "connect.token_generated": {"title": "🎫 Token generated", "color": 0x00FF00},
            "connect.token_expired": {"title": "⏰ Token expired", "color": 0xFFAA00},
            # Users
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
            # Products
            "product.created": {"title": "🎮 New product created", "color": 0x00FF00},
            "product.updated": {"title": "📝 Product updated", "color": 0x0099FF},
            "product.activated": {"title": "✅ Product activated", "color": 0x00FF00},
            "product.deactivated": {"title": "❌ Product deactivated", "color": 0xFF0000},
            "product.deleted": {"title": "🗑️ Product deleted", "color": 0xFF0000},
            "product.file_uploaded": {"title": "📤 File uploaded", "color": 0x0099FF},
            "product.file_downloaded": {"title": "📥 File downloaded", "color": 0x0099FF},
            "product.settings_changed": {"title": "⚙️ Settings changed", "color": 0x0099FF},
            "product.version_updated": {"title": "🔄 Version updated", "color": 0x0099FF},
            # Projects
            "project.created": {"title": "🏗️ New project created", "color": 0x00FF00},
            "project.updated": {"title": "📝 Project updated", "color": 0x0099FF},
            "project.deleted": {"title": "🗑️ Project deleted", "color": 0xFF0000},
            "project.settings_changed": {"title": "⚙️ Settings changed", "color": 0x0099FF},
            "project.member_added": {"title": "➕ Member added", "color": 0x00FF00},
            "project.member_removed": {"title": "➖ Member removed", "color": 0xFFAA00},
            "project.invite_created": {"title": "📨 Invite created", "color": 0x0099FF},
            "project.invite_accepted": {"title": "✅ Invite accepted", "color": 0x00FF00},
            # Security
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
            # Agents
            "agent.created": {"title": "🤖 Agent created", "color": 0x00FF00},
            "agent.updated": {"title": "📝 Agent updated", "color": 0x0099FF},
            "agent.deleted": {"title": "🗑️ Agent deleted", "color": 0xFF0000},
            "agent.downloaded": {"title": "📥 Agent downloaded", "color": 0x0099FF},
            "agent.version_updated": {"title": "🔄 Version updated", "color": 0x0099FF},
            "agent.status_changed": {"title": "🔄 Status changed", "color": 0x0099FF},
            "agent.product_assigned": {"title": "➕ Product assigned", "color": 0x00FF00},
            "agent.product_unassigned": {"title": "➖ Product unassigned", "color": 0xFFAA00},
            # Servers
            "server.created": {"title": "🖥️ Server created", "color": 0x00FF00},
            "server.updated": {"title": "📝 Server updated", "color": 0x0099FF},
            "server.deleted": {"title": "🗑️ Server deleted", "color": 0xFF0000},
            "server.status_changed": {"title": "🔄 Status changed", "color": 0x0099FF},
            "server.connected": {"title": "🔌 Server connected", "color": 0x00FF00},
            "server.disconnected": {"title": "🔌 Server disconnected", "color": 0xFFAA00},
            # Remote Control
            "remote.feature_enabled": {"title": "✅ Feature enabled", "color": 0x00FF00},
            "remote.feature_disabled": {"title": "❌ Feature disabled", "color": 0xFF0000},
            "remote.feature_updated": {"title": "📝 Feature updated", "color": 0x0099FF},
            "remote.category_created": {"title": "📁 Category created", "color": 0x0099FF},
            "remote.category_updated": {"title": "📝 Category updated", "color": 0x0099FF},
            "remote.category_deleted": {"title": "🗑️ Category deleted", "color": 0xFF0000},
            # Notifications
            "notification.created": {"title": "📢 Notification created", "color": 0x0099FF},
            "notification.sent": {"title": "📤 Notification sent", "color": 0x00FF00},
            "notification.read": {"title": "👁️ Notification read", "color": 0x666666},
            # RBAC
            "rbac.role_created": {"title": "👑 Role created", "color": 0x00FF00},
            "rbac.role_updated": {"title": "📝 Role updated", "color": 0x0099FF},
            "rbac.role_deleted": {"title": "🗑️ Role deleted", "color": 0xFF0000},
            "rbac.permission_granted": {"title": "✅ Permission granted", "color": 0x00FF00},
            "rbac.permission_revoked": {"title": "❌ Permission revoked", "color": 0xFF0000},
            "rbac.user_role_assigned": {"title": "➕ Role assigned", "color": 0x00FF00},
            "rbac.user_role_removed": {"title": "➖ Role removed", "color": 0xFFAA00},
            # Billing & Payments
            "billing.plan_changed": {"title": "💳 Plan changed", "color": 0x0099FF},
            "billing.payment_success": {"title": "✅ Payment success", "color": 0x00FF00},
            "billing.payment_failed": {"title": "❌ Payment failed", "color": 0xFF0000},
            "billing.subscription_expired": {"title": "⏰ Subscription expired", "color": 0xFFAA00},
            "billing.subscription_renewed": {"title": "🔄 Subscription renewed", "color": 0x00FF00},
            "billing.invoice_created": {"title": "📄 Invoice created", "color": 0x0099FF},
            "payment.completed": {"title": "✅ Payment completed", "color": 0x00FF00},
            "payment.failed": {"title": "❌ Payment failed", "color": 0xFF0000},
            "payment.refunded": {"title": "💰 Payment refunded", "color": 0xFFAA00},
            # Chat
            "chat.message_sent": {"title": "💬 Message sent", "color": 0x0099FF},
            "chat.group_created": {"title": "👥 Group created", "color": 0x00FF00},
            "chat.group_updated": {"title": "📝 Group updated", "color": 0x0099FF},
            "chat.group_deleted": {"title": "🗑️ Group deleted", "color": 0xFF0000},
            # System
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

    def _get_valid_events(self) -> List[str]:
        """Get list of valid webhook events"""
        return [
            # Keys
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
            # Connect
            "connect.success",
            "connect.failed",
            "connect.disconnected",
            "connect.challenge_requested",
            "connect.token_generated",
            "connect.token_expired",
            # Users
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
            # Products
            "product.created",
            "product.updated",
            "product.activated",
            "product.deactivated",
            "product.deleted",
            "product.file_uploaded",
            "product.file_downloaded",
            "product.settings_changed",
            "product.version_updated",
            # Security
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
            # Agents
            "agent.created",
            "agent.updated",
            "agent.deleted",
            "agent.downloaded",
            "agent.version_updated",
            "agent.status_changed",
            "agent.product_assigned",
            "agent.product_unassigned",
            # Servers
            "server.created",
            "server.updated",
            "server.deleted",
            "server.status_changed",
            "server.connected",
            "server.disconnected",
            # Remote Control
            "remote.feature_enabled",
            "remote.feature_disabled",
            "remote.feature_updated",
            "remote.category_created",
            "remote.category_updated",
            "remote.category_deleted",
            # Notifications
            "notification.created",
            "notification.sent",
            "notification.read",
            # RBAC
            "rbac.role_created",
            "rbac.role_updated",
            "rbac.role_deleted",
            "rbac.permission_granted",
            "rbac.permission_revoked",
            "rbac.user_role_assigned",
            "rbac.user_role_removed",
            # Billing & Payments
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

    def get_webhook_statistics(self, project_id: Optional[int] = None) -> Dict:
        """Get webhook statistics"""
        try:
            query = Webhook.query
            if project_id:
                query = query.filter(Webhook.project_id == project_id)

            webhooks = query.all()

            total_webhooks = len(webhooks)
            active_webhooks = len([w for w in webhooks if w.is_active])
            total_success = sum(w.success_count for w in webhooks)
            total_failures = sum(w.failure_count for w in webhooks)

            recent_logs = WebhookLog.query.filter(
                WebhookLog.created_at >= datetime.utcnow() - timedelta(hours=24)
            )
            if project_id:
                recent_logs = recent_logs.join(Webhook).filter(Webhook.project_id == project_id)

            recent_success = recent_logs.filter(WebhookLog.success == True).count()
            recent_failures = recent_logs.filter(WebhookLog.success == False).count()

            return {
                "total_webhooks": total_webhooks,
                "active_webhooks": active_webhooks,
                "total_success": total_success,
                "total_failures": total_failures,
                "success_rate": round(
                    total_success / max(1, total_success + total_failures) * 100, 2
                ),
                "recent_success": recent_success,
                "recent_failures": recent_failures,
                "recent_success_rate": round(
                    recent_success / max(1, recent_success + recent_failures) * 100, 2
                ),
            }

        except Exception as e:
            logging.error(f"WEBHOOK_STATISTICS_ERROR project_id={project_id} error={e}")
            return {}

    def validate_webhook_access(self, user_id: int, project_id: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """
        Validate user access to webhooks with all business logic

        Args:
            user_id: ID of the user
            project_id: Optional project ID to check access to

        Returns:
            Tuple of (has_access, error_message)
        """
        try:
            from ...services.rbac import rbac_service
            from ...utils.rbac_utils import RBACManager

            user = User.query.get(user_id)
            if not user:
                return False, "User not found"

            if not user.project_id:
                logging.warning(
                    f"WEBHOOK_ACCESS_BLOCKED: user_id={user.id} has no project_id - access denied"
                )
                return False, "User must be assigned to a project to manage webhooks"

            if not rbac_service.check_permission(user.id, "webhooks.view"):
                logging.warning(f"WEBHOOK_ACCESS_BLOCKED: user_id={user.id} insufficient permissions")
                return False, "Insufficient permissions"

            if project_id is not None:
                user_roles = RBACManager.get_user_role_names(user)
                is_owner = user_roles and user_roles[0] == "owner" if user_roles else False

                if not is_owner and project_id != user.project_id:
                    return False, "Access denied to this project"

            return True, None

        except Exception as e:
            logging.error(f"WEBHOOK_VALIDATION_ERROR user_id={user_id} error={e}")
            return False, "Internal server error"

    def validate_webhook_ownership(
        self, user_id: int, webhook_id: int
    ) -> Tuple[bool, Optional[str], Optional[Webhook]]:
        """
        Validate user ownership/access to a specific webhook with all business logic

        Args:
            user_id: ID of the user
            webhook_id: ID of the webhook

        Returns:
            Tuple of (has_access, error_message, webhook_object)
        """
        try:
            from ...utils.rbac_utils import RBACManager

            has_access, error = self.validate_webhook_access(user_id)
            if not has_access:
                return False, error, None

            user = User.query.get(user_id)

            # Get webhook
            webhook = Webhook.query.filter_by(id=webhook_id, project_id=user.project_id).first()
            if not webhook:
                return False, "Webhook not found", None

            user_roles = RBACManager.get_user_role_names(user)
            is_owner = user_roles and user_roles[0] == "owner" if user_roles else False

            if not is_owner and webhook.project_id != user.project_id:
                return False, "Access denied to this webhook", None

            return True, None, webhook

        except Exception as e:
            logging.error(f"WEBHOOK_OWNERSHIP_VALIDATION_ERROR user_id={user_id} webhook_id={webhook_id} error={e}")
            return False, "Internal server error", None

    def validate_webhook_creation_data(
        self,
        webhook_type: str,
        url: Optional[str] = None,
        telegram_bot_token: Optional[str] = None,
        telegram_chat_id: Optional[str] = None,
        discord_webhook_url: Optional[str] = None,
        discord_bot_token: Optional[str] = None,
        discord_channel_id: Optional[str] = None,
        name: Optional[str] = None,
        events: Optional[List[str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate webhook creation data with all business logic

        Args:
            webhook_type: Type of webhook (custom, telegram, discord)
            url: URL for custom webhooks
            telegram_bot_token: Telegram bot token
            telegram_chat_id: Telegram chat ID
            discord_webhook_url: Discord webhook URL
            discord_bot_token: Discord bot token
            discord_channel_id: Discord channel ID
            name: Webhook name
            events: List of events

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:

            if not all([name, events]):
                return False, "Missing required fields: name and events are required"

            if webhook_type == "custom":
                if not url:
                    return False, "URL is required for custom webhooks"
                if not self._validate_url(url):
                    return False, "Invalid webhook URL for custom type"
            elif webhook_type == "telegram":
                if not all([telegram_bot_token, telegram_chat_id]):
                    return False, "Bot token and chat ID/username are required for Telegram webhooks"
            elif webhook_type == "discord":
                if not (discord_webhook_url or (discord_bot_token and discord_channel_id)):
                    return False, "Webhook URL or bot token with channel ID are required for Discord webhooks"
            else:
                return False, f"Invalid webhook type: {webhook_type}"

            if events:
                valid_events = self._get_valid_events()
                for event in events:
                    if event not in valid_events:
                        return False, f"Invalid event: {event}"

            return True, None

        except Exception as e:
            logging.error(f"WEBHOOK_VALIDATION_ERROR error={e}")
            return False, "Internal server error"

webhook_service = None

def get_webhook_service():
    """Get webhook service instance"""
    global webhook_service
    if webhook_service is None:
        webhook_service = WebhookService()
    return webhook_service
