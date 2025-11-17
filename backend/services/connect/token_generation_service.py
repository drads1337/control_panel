"""
Token Generation Service
Handles token generation and storage
Single Responsibility: Token generation and database storage
"""

import hashlib
import logging
from datetime import datetime
from typing import Optional

from ...core.extensions import db
from ...models.keys import ConnectToken

logger = logging.getLogger(__name__)


class TokenGenerationService:
    """Handles token generation and storage"""

    def __init__(self, static_word: str = "panel_auth_2024"):
        """
        Initialize token generation service

        Args:
            static_word: Static word used in token generation
        """
        self.static_word = static_word

    def generate_connect_token(
        self,
        game: str,
        user_key: str,
        serial: str,
        user_id: Optional[int] = None,
        key_id: Optional[int] = None,
        expires_at: Optional[datetime] = None,
        is_classic: bool = False,
    ) -> str:
        """
        Generate connect token for successful authentication and store it in database.
        
        This function now stores tokens in the database for secure O(1) validation,
        preventing DoS attacks from token enumeration.

        Args:
            game: Game name
            user_key: User key
            serial: Device serial
            user_id: User ID (required for database storage)
            key_id: Key ID (optional, for regular tokens)
            expires_at: Token expiration datetime (optional)
            is_classic: Whether this is a classic token (default: False)

        Returns:
            Generated token (SHA256 hash)
        """
        real = f"{game}-{user_key}-{serial}-{self.static_word}"
        token = hashlib.sha256(real.encode()).hexdigest()
        
        # Store token in database for secure validation
        if user_id is not None:
            try:
                # Check if token already exists (shouldn't happen, but handle gracefully)
                existing_token = ConnectToken.query.filter_by(token=token).first()
                if existing_token:
                    # Update last_used if exists
                    existing_token.last_used = datetime.utcnow()
                    db.session.commit()
                else:
                    # Create new token record
                    connect_token = ConnectToken(
                        token=token,
                        user_id=user_id,
                        key_id=key_id,
                        game_name=game,
                        serial=serial,
                        is_classic=is_classic,
                        expires_at=expires_at,
                        created_at=datetime.utcnow()
                    )
                    db.session.add(connect_token)
                    db.session.commit()
                    logger.debug(f"Token stored in database: {token[:20]}...")
            except Exception as e:
                # Log error but don't fail token generation
                logger.error(f"Failed to store connect token in database: {e}")
                # Continue without database storage (backward compatibility)
        
        return token

