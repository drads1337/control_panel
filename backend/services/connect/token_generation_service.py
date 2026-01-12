"""
Token Generation Service
Handles token generation and storage
Single Responsibility: Token generation and database storage

SECURITY: Tokens are random, short-lived, and bound to device/certificate fingerprints.
Per-project secret_key is still required to ensure project isolation is configured.
"""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

from ...config.config import Config
from ...core.extensions import db
from ...models.keys import ConnectToken
from ...models.core import Project

logger = logging.getLogger(__name__)

class TokenGenerationService:
    """
    Handles token generation and storage
    
    SECURITY: REQUIRES per-project secret_key from database for token generation.
    No fallback to TOKEN_STATIC_WORD is allowed in production.
    All projects must have secret_key set (auto-generated on creation or via migration).
    """

    def __init__(self, static_word: Optional[str] = None):
        """
        Initialize token generation service

        Args:
            static_word: DEPRECATED - kept only for type compatibility. Not used in production.
        
        SECURITY:
        =========
        This service REQUIRES project.secret_key from the database for token generation.
        All projects must have secret_key set (auto-generated on creation or via migration).
        No fallback to TOKEN_STATIC_WORD is allowed in production for security.
        """

        self.static_word = static_word or Config.TOKEN_STATIC_WORD if static_word else None

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
        fingerprint: str = "",
        cert_fingerprint: str = "",
    ) -> str:
        """
        Generate connect token for successful authentication and store it in database.

        This function now stores tokens in the database for secure O(1) validation,
        preventing DoS attacks from token enumeration.

        SECURITY: Tokens are random, short-lived, and bound to device/cert fingerprints.
        Project.secret_key is still required (isolation), even though it is not used
        directly for token material.

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


        if project_id is None:
            raise ValueError(
                "project_id is required for token generation. "
                "Token generation requires project.secret_key for security isolation."
            )
        

        try:
            project = Project.query.filter_by(id=project_id).first()
            if not project:
                raise ValueError(f"Project {project_id} not found")
            
            if not project.secret_key:
                raise ValueError(
                    f"Project {project_id} is missing secret_key. "
                    f"This is a configuration error. "
                    f"Please run migration to generate secret_key for all projects, "
                    f"or ensure new projects have secret_key set during creation."
                )
            
            unique_salt = project.secret_key  # kept for validation; not used in token material
            logger.debug(f"Using project {project_id} secret_key for token generation")
        except ValueError:

            raise
        except Exception as e:

            logger.error(
                f"CRITICAL: Failed to get project {project_id} secret_key: {e}. "
                f"This is a database error, not a configuration issue."
            )
            raise ValueError(
                f"Database error retrieving project {project_id} secret_key. "
                f"Please contact support if this persists."
            ) from e
        
        now = datetime.utcnow()
        ttl_minutes = getattr(Config, "CONNECT_TOKEN_TTL_MIN", 15)
        ttl_minutes = max(1, int(ttl_minutes or 15))

        desired_exp = now + timedelta(minutes=ttl_minutes)
        # Limit by provided key expiration if any
        if expires_at:
            desired_exp = min(desired_exp, expires_at)

        token = secrets.token_hex(32)  # 64 hex chars

        if user_id is not None:
            try:

                existing_token = ConnectToken.query.filter_by(token=token).first()
                if existing_token:
                    existing_token.last_used = now
                    existing_token.expires_at = desired_exp
                    if fingerprint:
                        existing_token.fingerprint = fingerprint
                    if cert_fingerprint:
                        existing_token.cert_fingerprint = cert_fingerprint
                else:
                    connect_token = ConnectToken(
                        token=token,
                        user_id=user_id,
                        key_id=key_id,
                        product_name=product,
                        serial=serial,
                        is_classic=is_classic,
                        expires_at=desired_exp,
                        created_at=now,
                        fingerprint=fingerprint or None,
                        cert_fingerprint=cert_fingerprint or None,
                    )
                    db.session.add(connect_token)

                db.session.commit()
                logger.debug(f"Token stored in database: {token[:20]}...")
            except Exception as e:

                logger.error(f"Failed to store connect token in database: {e}")

        return token
