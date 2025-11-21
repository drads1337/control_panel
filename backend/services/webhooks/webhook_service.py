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
import threading
import time
import traceback
import uuid
from datetime import datetime, timedelta
from queue import Empty, Queue
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests
from flask import current_app

from ...core.extensions import db
from ...models.core import Project, User
from ...models.products import Product
from ...models.keys import Key
from ...models.webhooks import Webhook, WebhookLog

class WebhookService:
    """Service for managing webhook notifications"""

    def __init__(self):
        self.webhook_queue = Queue()
        self.max_retries = 3
        self.retry_delay = 5
        self.timeout = 10
        self.max_workers = 5

        self._start_worker()

    def _start_worker(self):
        """Start background worker for processing webhooks"""

        def worker():
            while True:
                try:
                    webhook_data = self.webhook_queue.get(timeout=1)
                    if webhook_data is None:
                        break

                    self._process_webhook(webhook_data)
                    self.webhook_queue.task_done()

                except Empty:

                    continue
                except Exception as e:
                    logging.error(f"WEBHOOK_WORKER_ERROR: {e}")
                    logging.error(f"WEBHOOK_WORKER_TRACEBACK: {traceback.format_exc()}")
                    time.sleep(1)

        for i in range(self.max_workers):
            thread = threading.Thread(target=worker, daemon=True)
            thread.start()

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
        """Get webhooks for a project"""
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
                    "secret": webhook.secret,
                    "is_active": webhook.is_active,
                    "headers": json.loads(webhook.headers or "{}"),

                    "telegram_bot_token": webhook.telegram_bot_token,
                    "telegram_chat_id": webhook.telegram_chat_id,

                    "discord_webhook_url": webhook.discord_webhook_url,
                    "discord_bot_token": webhook.discord_bot_token,
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

                self.webhook_queue.put(webhook_data)

            logging.info(
                f"WEBHOOK_TRIGGERED event={event} project_id={project_id} webhook_count={len(webhooks)}"
            )
            return True

        except Exception as e:
            logging.error(f"WEBHOOK_TRIGGER_ERROR event={event} project_id={project_id} error={e}")
            return False

    def _process_webhook(self, webhook_data: Dict):
        """Process a webhook request"""
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
        
        This method:
        1. Only allows HTTPS URLs (not HTTP) for security
        2. Resolves domain to IP address
        3. Blocks localhost, private IP ranges, and internal network addresses
        4. Prevents SSRF attacks on internal services
        
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
            }
            if hostname.lower() in blocked_hostnames:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Blocked hostname {hostname}")
                return False
            
            # SECURITY: Resolve hostname to IP address
            try:
                ip_address = socket.gethostbyname(hostname)
            except (socket.gaierror, socket.herror, OSError) as e:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Failed to resolve {hostname}: {e}")
                return False
            
            # SECURITY: Check if IP is in blocked ranges
            try:
                ip_obj = ipaddress.ip_address(ip_address)
            except ValueError:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Invalid IP address {ip_address}")
                return False
            
            # SECURITY: Block private IP ranges (RFC 1918)
            # 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
            if ip_obj.is_private:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Private IP range {ip_address}")
                return False
            
            # SECURITY: Block loopback addresses
            if ip_obj.is_loopback:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Loopback address {ip_address}")
                return False
            
            # SECURITY: Block link-local addresses (169.254.0.0/16)
            if ip_obj.is_link_local:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Link-local address {ip_address}")
                return False
            
            # SECURITY: Block multicast addresses
            if ip_obj.is_multicast:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Multicast address {ip_address}")
                return False
            
            # SECURITY: Block reserved addresses (0.0.0.0/8, etc.)
            if ip_obj.is_reserved:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Reserved address {ip_address}")
                return False
            
            # SECURITY: Block cloud metadata endpoints (AWS, GCP, Azure)
            # These are often at 169.254.169.254 but also check for common patterns
            metadata_hostnames = {
                "169.254.169.254",  # AWS, GCP, Azure metadata
                "metadata.google.internal",  # GCP
                "169.254.169.254.nip.io",  # DNS rebinding attack
            }
            if hostname.lower() in metadata_hostnames or ip_address == "169.254.169.254":
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Cloud metadata endpoint {hostname} -> {ip_address}")
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
            
            logging.debug(f"WEBHOOK_URL_VALIDATED: {hostname} -> {ip_address}")
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
            "key.created": "🔑 New key created",
            "key.activated": "✅ Key activated",
            "key.expired": "⏰ Key expired",
            "key.blocked": "🚫 Key blocked",
            "key.unblocked": "✅ Key unblocked",
            "user.registered": "👤 New user registered",
            "user.logout": "👋 User logged out",
            "user.password_changed": "🔐 Password changed",
            "user.role_changed": "👑 User role changed",
            "project.created": "🏗️ New project created",
            "project.updated": "📝 Project updated",
            "product.created": "🎮 New product created",
            "product.updated": "🎮 Product updated",
            "security.alert": "⚠️ Security alert",
            "security.block": "🚫 Security block",
            "system.maintenance": "🔧 System maintenance",
            "system.error": "❌ System error",
            "user.created": "👤 New user",
            "user.login": "🔐 User login",
            "user.logout": "👋 User logout",
            "product.created": "🎮 New product",
            "product.updated": "📝 Product updated",
            "product.activated": "✅ Product activated",
            "product.deactivated": "❌ Product deactivated",
            "security.alert": "⚠️ Security alert",
            "security.block": "🛡️ Security block",
            "system.maintenance": "🔧 System maintenance",
            "system.error": "❌ System error",
        }

        title = event_names.get(event, f"📢 Event: {event}")

        message = f"<b>{title}</b>\n\n"

        if event.startswith("key."):
            message += f"<b>Key:</b> {data.get('key_value', 'N/A')}\n"
            message += f"<b>User ID:</b> {data.get('user_id', 'N/A')}\n"
        elif event.startswith("user."):
            message += f"<b>User:</b> {data.get('username', 'N/A')}\n"
            message += f"<b>Email:</b> {data.get('email', 'N/A')}\n"
        elif event.startswith("product."):
            message += f"<b>Product:</b> {data.get('product_name', 'N/A')}\n"
            message += f"<b>Status:</b> {data.get('status', 'N/A')}\n"
        elif event.startswith("security."):
            message += f"<b>Details:</b> {data.get('details', 'N/A')}\n"
            message += f"<b>IP:</b> {data.get('ip_address', 'N/A')}\n"

        message += f"\n<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"

        return message

    def _format_discord_embed(self, event: str, data: Dict) -> Dict:
        """Format embed for Discord"""
        event_info = {
            "key.created": {"title": "🔑 New key created", "color": 0x00FF00},
            "key.activated": {"title": "✅ Key activated", "color": 0x00FF00},
            "key.expired": {"title": "⏰ Key expired", "color": 0xFFAA00},
            "key.blocked": {"title": "🚫 Key blocked", "color": 0xFF0000},
            "key.unblocked": {"title": "✅ Key unblocked", "color": 0x00FF00},
            "user.registered": {
                "title": "👤 New user registered",
                "color": 0x0099FF,
            },
            "user.logout": {"title": "👋 User logged out", "color": 0xFFA500},
            "user.password_changed": {"title": "🔐 Password changed", "color": 0xFFFF00},
            "user.role_changed": {"title": "👑 User role changed", "color": 0x9932CC},
            "project.created": {"title": "🏗️ New project created", "color": 0x00FF00},
            "project.updated": {"title": "📝 Project updated", "color": 0x0099FF},
            "product.created": {"title": "🎮 New product created", "color": 0x00FF00},
            "product.updated": {"title": "🎮 Product updated", "color": 0x0099FF},
            "security.alert": {"title": "⚠️ Security alert", "color": 0xFFA500},
            "security.block": {"title": "🚫 Security block", "color": 0xFF0000},
            "system.maintenance": {"title": "🔧 System maintenance", "color": 0x0099FF},
            "system.error": {"title": "❌ System error", "color": 0xFF0000},
            "user.created": {"title": "👤 New user", "color": 0x0099FF},
            "user.login": {"title": "🔐 User login", "color": 0x00FF00},
            "user.logout": {"title": "👋 User logout", "color": 0x666666},
            "product.created": {"title": "🎮 New product", "color": 0x00FF00},
            "product.updated": {"title": "📝 Product updated", "color": 0x0099FF},
            "product.activated": {"title": "✅ Product activated", "color": 0x00FF00},
            "product.deactivated": {"title": "❌ Product deactivated", "color": 0xFF0000},
            "security.alert": {"title": "⚠️ Security alert", "color": 0xFFAA00},
            "security.block": {"title": "🛡️ Security block", "color": 0xFF0000},
            "system.maintenance": {"title": "🔧 System maintenance", "color": 0x666666},
            "system.error": {"title": "❌ System error", "color": 0xFF0000},
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
            "key.created",
            "key.activated",
            "key.expired",
            "key.blocked",
            "key.unblocked",
            "user.created",
            "user.registered",
            "user.login",
            "user.logout",
            "user.password_changed",
            "user.role_changed",
            "product.created",
            "product.updated",
            "product.activated",
            "product.deactivated",
            "project.created",
            "project.updated",
            "security.alert",
            "security.block",
            "system.maintenance",
            "system.error",
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
