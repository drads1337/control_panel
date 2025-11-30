"""
Envelope Encryption Implementation (DEK/KEK Pattern)

This module implements Envelope Encryption for project encryption keys.
Instead of storing plain-text keys in the database, we use a two-layer approach:

1. KEK (Key Encryption Key) - Master key stored only in environment variables
2. DEK (Data Encryption Key) - Project keys encrypted with KEK, stored in database

This provides defense-in-depth: even if the database is compromised,
the keys cannot be decrypted without the KEK from environment.

Architecture:
┌─────────────────────────────────────────┐
│  KEK (from PROJECT_MASTER_KEY env)      │
│  - Only in memory/env                   │
│  - Never written to DB                  │
└─────────────────────────────────────────┘
              │
              │ encrypts
              ▼
┌─────────────────────────────────────────┐
│  DEK (encrypted project key)            │
│  - Stored in ProjectEncryptionKeys      │
│  - Encrypted with KEK                   │
└─────────────────────────────────────────┘
              │
              │ encrypts
              ▼
┌─────────────────────────────────────────┐
│  Project Data                            │
│  - Encrypted with DEK                    │
└─────────────────────────────────────────┘
"""

import base64
import logging
import os
from typing import Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)


class EnvelopeKeyManager:
    """
    Manages Envelope Encryption for project keys.
    
    Uses KEK (Key Encryption Key) from environment to encrypt/decrypt
    DEK (Data Encryption Key) which are project-specific keys.
    """
    
    _kek: Optional[bytes] = None
    _fernet: Optional[Fernet] = None
    
    @classmethod
    def _get_kek_from_env(cls) -> bytes:
        """
        Get KEK (Key Encryption Key) from environment variable.
        
        Returns:
            KEK as bytes
            
        Raises:
            ValueError: If PROJECT_MASTER_KEY is not set or invalid
        """
        kek_hex = os.getenv('PROJECT_MASTER_KEY')
        if not kek_hex:
            raise ValueError(
                "PROJECT_MASTER_KEY environment variable is required. "
                "This is the master key that encrypts all project keys. "
                "Generate with: python -c 'import secrets; print(secrets.token_hex(32))'"
            )
        
        # Validate format (64 hex characters = 32 bytes)
        if len(kek_hex) != 64:
            raise ValueError(
                f"PROJECT_MASTER_KEY must be 64 hex characters (32 bytes), got {len(kek_hex)}"
            )
        
        try:
            kek_bytes = bytes.fromhex(kek_hex)
            if len(kek_bytes) != 32:
                raise ValueError("KEK must be exactly 32 bytes")
            return kek_bytes
        except ValueError as e:
            raise ValueError(f"Invalid PROJECT_MASTER_KEY format: {e}")
    
    @classmethod
    def _get_kek(cls) -> bytes:
        """
        Get or cache KEK from environment.
        
        Returns:
            KEK as bytes
        """
        if cls._kek is None:
            cls._kek = cls._get_kek_from_env()
        return cls._kek
    
    @classmethod
    def _get_fernet(cls) -> Fernet:
        """
        Get or create Fernet instance for KEK encryption.
        
        Fernet uses AES-128 in CBC mode with HMAC-SHA256 for authentication.
        We derive a 32-byte key from KEK using PBKDF2 for Fernet compatibility.
        
        Returns:
            Fernet instance
        """
        if cls._fernet is None:
            kek = cls._get_kek()
            
            # Derive Fernet-compatible key from KEK using PBKDF2
            # Fernet requires exactly 32 bytes (URL-safe base64 encoded)
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'envelope_encryption_salt',  # Fixed salt for deterministic key derivation
                iterations=100000,  # High iteration count for security
                backend=default_backend()
            )
            fernet_key = base64.urlsafe_b64encode(kdf.derive(kek))
            cls._fernet = Fernet(fernet_key)
        
        return cls._fernet
    
    @classmethod
    def encrypt_dek(cls, dek: bytes) -> str:
        """
        Encrypt a Data Encryption Key (DEK) with KEK.
        
        Args:
            dek: Plain DEK as bytes (typically 32 bytes for AES-256)
            
        Returns:
            Encrypted DEK as base64-encoded string
        """
        try:
            fernet = cls._get_fernet()
            encrypted_dek = fernet.encrypt(dek)
            return base64.b64encode(encrypted_dek).decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to encrypt DEK: {e}", exc_info=True)
            raise ValueError(f"DEK encryption failed: {e}") from e
    
    @classmethod
    def decrypt_dek(cls, encrypted_dek: str) -> bytes:
        """
        Decrypt a Data Encryption Key (DEK) with KEK.
        
        Args:
            encrypted_dek: Encrypted DEK as base64-encoded string
            
        Returns:
            Plain DEK as bytes
        """
        try:
            fernet = cls._get_fernet()
            encrypted_bytes = base64.b64decode(encrypted_dek.encode('utf-8'))
            dek = fernet.decrypt(encrypted_bytes)
            return dek
        except Exception as e:
            logger.error(f"Failed to decrypt DEK: {e}", exc_info=True)
            raise ValueError(f"DEK decryption failed: {e}") from e
    
    @classmethod
    def encrypt_dek_string(cls, dek_string: str) -> str:
        """
        Encrypt a DEK string (hex-encoded key) with KEK.
        
        Args:
            dek_string: Plain DEK as hex string (64 characters for 32 bytes)
            
        Returns:
            Encrypted DEK as base64-encoded string
        """
        try:
            # Convert hex string to bytes
            dek_bytes = bytes.fromhex(dek_string)
            return cls.encrypt_dek(dek_bytes)
        except ValueError as e:
            raise ValueError(f"Invalid DEK format: {e}") from e
    
    @classmethod
    def decrypt_dek_string(cls, encrypted_dek: str) -> str:
        """
        Decrypt a DEK and return as hex string.
        
        Args:
            encrypted_dek: Encrypted DEK as base64-encoded string
            
        Returns:
            Plain DEK as hex string (64 characters)
        """
        dek_bytes = cls.decrypt_dek(encrypted_dek)
        return dek_bytes.hex()
    
    @classmethod
    def validate_kek_set(cls) -> bool:
        """
        Check if KEK is properly configured.
        
        Returns:
            True if KEK is set and valid, False otherwise
        """
        try:
            cls._get_kek_from_env()
            return True
        except (ValueError, TypeError):
            return False
    
    @classmethod
    def clear_cache(cls):
        """
        Clear cached KEK and Fernet instance.
        
        Useful for testing or when KEK needs to be reloaded.
        """
        cls._kek = None
        cls._fernet = None


# SECURITY: No fallback to plain key if decryption fails
def get_project_key_safe(project_id: int, use_envelope: bool = True) -> str:
    """
    Get project encryption key with Envelope Encryption support.
    
    SECURITY: If encrypted key exists, decryption MUST succeed. No fallback to plain key.
    If decryption fails, this is a configuration error.
    
    Args:
        project_id: Project ID
        use_envelope: Whether to use Envelope Encryption (default: True)
        
    Returns:
        Project encryption key as hex string
        
    Raises:
        ValueError: If no key is found or decryption fails
    """
    from ..models.core import ProjectEncryptionKeys
    
    encryption_keys = ProjectEncryptionKeys.query.filter_by(project_id=project_id).first()
    if not encryption_keys:
        raise ValueError(f"No encryption keys found for project {project_id}")
    
    # SECURITY: If encrypted key exists, Envelope Encryption is REQUIRED
    if use_envelope and EnvelopeKeyManager.validate_kek_set():
        # Check if key is encrypted (new format)
        if hasattr(encryption_keys, 'aes_key_encrypted') and encryption_keys.aes_key_encrypted:
            try:
                return EnvelopeKeyManager.decrypt_dek_string(encryption_keys.aes_key_encrypted)
            except Exception as e:
                logger.error(
                    f"CRITICAL: Failed to decrypt DEK for project {project_id}: {e}. "
                    f"This is a configuration error - encrypted key exists but cannot be decrypted."
                )
                raise ValueError(
                    f"Failed to decrypt encrypted key for project {project_id}. "
                    f"This is a configuration error. "
                    f"Please ensure PROJECT_MASTER_KEY is correct or contact support."
                ) from e
        
        # If no encrypted key, check for plain key (legacy projects)
        if hasattr(encryption_keys, 'aes_key') and encryption_keys.aes_key:
            logger.warning(
                f"Project {project_id} using plain key (legacy). "
                f"Consider migrating to Envelope Encryption for better security."
            )
            return encryption_keys.aes_key
    
    # Legacy behavior: return plain key (for projects that haven't migrated)
    if hasattr(encryption_keys, 'aes_key') and encryption_keys.aes_key:
        return encryption_keys.aes_key
    
    raise ValueError(f"No encryption key found for project {project_id}")

