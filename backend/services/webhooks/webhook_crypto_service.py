"""
Webhook Crypto Service
Handles cryptographic operations for webhooks (secrets, signatures)
"""

import hashlib
import hmac
import secrets
import logging


class WebhookCryptoService:
    """Service for cryptographic operations related to webhooks"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def generate_secret(self) -> str:
        """Generate a random webhook secret"""
        return secrets.token_urlsafe(32)

    def generate_signature(self, payload: str, secret: str) -> str:
        """Generate HMAC signature for webhook payload"""
        return hmac.new(
            secret.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()


webhook_crypto_service = WebhookCryptoService()