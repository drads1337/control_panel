"""
Webhook Testing Service
Handles testing of webhooks with test payloads
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Dict

import requests

from ...models.webhooks import Webhook


class WebhookTestingService:
    """Service for testing webhooks"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.timeout = 10

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
            self.logger.error(f"WEBHOOK_TEST_ERROR webhook_id={webhook_id} error={e}")
            return {
                "success": False,
                "status_code": None,
                "response_text": None,
                "error_message": str(e),
            }

    def _test_telegram_webhook(self, webhook: Webhook, test_data: Dict) -> Dict:
        """Test Telegram webhook"""
        try:
            from .webhook_formatting_service import webhook_formatting_service

            if not webhook.telegram_bot_token or not webhook.telegram_chat_id:
                return {
                    "success": False,
                    "status_code": None,
                    "response_text": None,
                    "error_message": "Telegram bot token and chat ID are required",
                }

            message = webhook_formatting_service.format_telegram_message(
                "test", test_data, webhook.message_template
            )

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
            from .webhook_formatting_service import webhook_formatting_service

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

            embed = webhook_formatting_service.format_discord_embed("test", test_data)

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
            from .webhook_crypto_service import webhook_crypto_service

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
                signature = webhook_crypto_service.generate_signature(
                    json.dumps(payload), webhook.secret
                )
                headers["X-Webhook-Signature"] = f"sha256={signature}"

            headers["Content-Type"] = "application/json"

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


# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   webhook_testing_service = get_service('webhook_testing_service')

