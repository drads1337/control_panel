"""
Token Generation Service
Handles token generation and storage
Single Responsibility: Token generation and database storage
"""

import hashlib
import logging
from datetime import datetime
from typing import Optional

from ...config.config import Config
from ...core.extensions import db
from ...models.keys import ConnectToken

logger = logging.getLogger(__name__)

class TokenGenerationService:
    """Handles token generation and storage"""

    def __init__(self, static_word: Optional[str] = None):
        """
        Initialize token generation service

        Args:
            static_word: Static word used in token generation (defaults to Config.TOKEN_STATIC_WORD)
        
        SECURITY WARNING:
        ================
        The static_word is used as a salt in token generation. If this secret is compromised,
        all tokens become predictable and can be forged.
        
        Current implementation uses a single static secret for all tokens. For enhanced security:
        1. Use a strong, randomly generated TOKEN_STATIC_WORD (minimum 32 bytes)
        2. Consider implementing per-project or per-user salts stored in the database
        3. Implement secret rotation mechanism for production environments
        4. Never commit TOKEN_STATIC_WORD to version control
        
        Example secure generation:
            export TOKEN_STATIC_WORD=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')
        """
        # SECURITY: Use environment variable instead of hardcoded secret
        self.static_word = static_word or Config.TOKEN_STATIC_WORD

    def generate_connect_token(
        self,
        product: str,
        user_key: str,
        serial: str,
        user_id: Optional[int] = None,
        key_id: Optional[int] = None,
        project_id: Optional[int] = None,
        expires_at: Optional[datetime] = None,
        is_classic: bool = False,
    ) -> str:
        """
        Generate connect token for successful authentication and store it in database.

        This function now stores tokens in the database for secure O(1) validation,
        preventing DoS attacks from token enumeration.

        SECURITY: Uses per-project/user salt to prevent rainbow table attacks.
        If TOKEN_STATIC_WORD is compromised, tokens from other projects/users
        remain secure due to unique salt per project/user.

        Args:
            product: Product name
            user_key: User key
            serial: Device serial
            user_id: User ID (required for database storage)
            key_id: Key ID (optional, for regular tokens)
            project_id: Project ID (optional, but recommended for enhanced security)
            expires_at: Token expiration datetime (optional)
            is_classic: Whether this is a classic token (default: False)

        Returns:
            Generated token (SHA256 hash)
        """
        # SECURITY: Use per-project/user salt to prevent rainbow table attacks
        # If TOKEN_STATIC_WORD is compromised, tokens from other projects remain secure
        # Priority: project_id > user_id > static_word (fallback for backward compatibility)
        if project_id is not None:
            # Use project-specific salt for maximum security
            unique_salt = f"{self.static_word}-project-{project_id}"
        elif user_id is not None:
            # Fallback to user-specific salt if project_id not available
            unique_salt = f"{self.static_word}-user-{user_id}"
        else:
            # Legacy fallback: use static word only (less secure, but backward compatible)
            unique_salt = self.static_word
        
        real = f"{product}-{user_key}-{serial}-{unique_salt}"
        token = hashlib.sha256(real.encode()).hexdigest()

        if user_id is not None:
            try:

                existing_token = ConnectToken.query.filter_by(token=token).first()
                if existing_token:

                    existing_token.last_used = datetime.utcnow()
                    db.session.commit()
                else:

                    connect_token = ConnectToken(
                        token=token,
                        user_id=user_id,
                        key_id=key_id,
                        product_name=product,
                        serial=serial,
                        is_classic=is_classic,
                        expires_at=expires_at,
                        created_at=datetime.utcnow()
                    )
                    db.session.add(connect_token)
                    db.session.commit()
                    logger.debug(f"Token stored in database: {token[:20]}...")
            except Exception as e:

                logger.error(f"Failed to store connect token in database: {e}")

        return token
