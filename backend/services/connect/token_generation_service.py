"""
Token Generation Service
Handles token generation and storage
Single Responsibility: Token generation and database storage

SECURITY: This service now uses per-project secret_key from the database instead of
a global TOKEN_STATIC_WORD. This ensures that if one project's secret is compromised,
tokens for other projects remain secure.
"""

import hashlib
import logging
from datetime import datetime
from typing import Optional

from ...config.config import Config
from ...core.extensions import db
from ...models.keys import ConnectToken
from ...models.core import Project

logger = logging.getLogger(__name__)

class TokenGenerationService:
    """
    Handles token generation and storage
    
    SECURITY: Uses per-project secret_key from database for token generation.
    Falls back to TOKEN_STATIC_WORD only for backward compatibility with legacy projects.
    """

    def __init__(self, static_word: Optional[str] = None):
        """
        Initialize token generation service

        Args:
            static_word: Legacy static word used as fallback (defaults to Config.TOKEN_STATIC_WORD)
        
        SECURITY:
        =========
        This service now uses project.secret_key from the database for token generation.
        The static_word parameter is kept only for backward compatibility with legacy projects
        that may not have secret_key set yet.
        
        For new projects, secret_key is automatically generated when the project is created.
        """
        # Keep static_word for backward compatibility only
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

        SECURITY: Uses per-project secret_key from database for token generation.
        This ensures that if one project's secret is compromised, tokens for other
        projects remain secure. Falls back to TOKEN_STATIC_WORD only for legacy projects.

        Args:
            product: Product name
            user_key: User key
            serial: Device serial
            user_id: User ID (required for database storage)
            key_id: Key ID (optional, for regular tokens)
            project_id: Project ID (required for secure token generation)
            expires_at: Token expiration datetime (optional)
            is_classic: Whether this is a classic token (default: False)

        Returns:
            Generated token (SHA256 hash)
        """
        # SECURITY: Use project.secret_key from database for maximum security
        # Priority: project.secret_key > user_id-based salt > static_word (legacy fallback)
        unique_salt = None
        
        if project_id is not None:
            # Try to get project secret_key from database
            try:
                project = Project.query.filter_by(id=project_id).first()
                if project and project.secret_key:
                    # Use project-specific secret_key (most secure)
                    unique_salt = project.secret_key
                    logger.debug(f"Using project {project_id} secret_key for token generation")
                else:
                    # Project exists but doesn't have secret_key (legacy project)
                    # Use project_id-based salt as fallback
                    unique_salt = f"{self.static_word}-project-{project_id}"
                    logger.warning(
                        f"Project {project_id} missing secret_key, using fallback salt. "
                        f"Run migration to generate secret_key."
                    )
            except Exception as e:
                # Database error - use fallback
                logger.warning(f"Failed to get project {project_id} secret_key: {e}, using fallback")
                unique_salt = f"{self.static_word}-project-{project_id}"
        elif user_id is not None:
            # Fallback to user-specific salt if project_id not available
            unique_salt = f"{self.static_word}-user-{user_id}"
            logger.warning("No project_id provided, using user-based salt (less secure)")
        else:
            # Legacy fallback: use static word only (least secure, but backward compatible)
            unique_salt = self.static_word
            logger.warning("No project_id or user_id provided, using global static_word (insecure)")
        
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
