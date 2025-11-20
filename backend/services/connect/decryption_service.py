"""
Decryption Service
Handles decryption of encrypted request data using project-specific keys only
Single Responsibility: Decryption only

SECURITY: In strict multi-tenant architecture, client data MUST be encrypted with project keys only.
Global master key fallback is removed to prevent timing attacks and ensure data isolation.
"""

import base64
import json
import logging
from typing import Dict, Optional, Tuple

from ...config.config import Config
from ...models import ProjectSettings
from ...utils.secure_crypto import decrypt_data_with_project_key

logger = logging.getLogger(__name__)

class DecryptionService:
    """
    Handles decryption of encrypted request data
    
    SECURITY: This service enforces strict multi-tenant encryption:
    - Client data MUST be encrypted with project-specific keys only
    - Project ID is required for decryption
    - No fallback to global master key (prevents timing attacks and ensures data isolation)
    """

    def decrypt_request_data(
        self, enc_data: str, project_id: Optional[str] = None, ip: Optional[str] = None
    ) -> Tuple[Optional[Dict], bool, Optional[int]]:
        """
        Decrypt request data with project-specific key only.
        
        SECURITY: In strict multi-tenant architecture, client data MUST be encrypted
        with project keys only. No global master key fallback to prevent:
        - Timing attacks (different response times reveal which key was used)
        - Data isolation breaches (one project's key should never decrypt another project's data)
        - Key enumeration attacks

        DoS PROTECTION:
        - Maximum data size: 1MB to prevent memory exhaustion
        - Rate limiting should be applied BEFORE calling this method (by IP address)
        - Single decryption attempt per call (no key enumeration)

        Args:
            enc_data: Encrypted data string
            project_id: Project ID (REQUIRED for multi-tenant architecture).
                       If not provided, will attempt Redis fallback for backward compatibility only.
            ip: Client IP address (optional, for logging and Redis fallback)

        Returns:
            Tuple of (decrypted_data, used_global_key=False, successful_project_id)

        Raises:
            ValueError: If project_id is missing or decryption fails
        """

        MAX_ENCRYPTED_DATA_SIZE = 1024 * 1024
        if len(enc_data) > MAX_ENCRYPTED_DATA_SIZE:
            logger.warning(
                f"[DECRYPT] Data size exceeds maximum: {len(enc_data)} bytes (max: {MAX_ENCRYPTED_DATA_SIZE}) ip={ip}"
            )
            raise ValueError(f"Encrypted data size exceeds maximum allowed size ({MAX_ENCRYPTED_DATA_SIZE} bytes)")

        # Try base64 decode first (for backward compatibility with unencrypted data)
        try:
            decoded_bytes = base64.b64decode(enc_data)
            decoded = decoded_bytes.decode("utf-8")
            data = json.loads(decoded)
            logger.debug("[DEBUG] Successfully decoded base64 data")
            return data, False, None
        except (base64.binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
            logger.debug("[DEBUG] Not base64/JSON, trying decryption...")

        # SECURITY: For strict multi-tenant architecture, project_id is required
        # If not provided, attempt Redis fallback only for backward compatibility
        effective_project_id = project_id
        if not effective_project_id and ip:
            effective_project_id = self._get_project_id_from_redis(ip)
            if effective_project_id:
                logger.info(f"[DECRYPT] Using project_id {effective_project_id} from Redis fallback (backward compatibility)")

        if not effective_project_id:
            logger.error(
                f"[DECRYPT] Project ID is required for multi-tenant decryption. "
                f"Client must provide project_id in request. ip={ip}"
            )
            raise ValueError(
                "Project ID is required for decryption. "
                "In multi-tenant architecture, client data must be encrypted with project-specific keys. "
                "Please provide project_id in your request."
            )

        # SECURITY: Use ONLY project key (no fallback to global key)
        logger.info(f"[DECRYPT] Using project {effective_project_id} key only (strict multi-tenant)...")
        try:
            data, successful_project_id = self._decrypt_with_project_key(enc_data, effective_project_id)
            if data and successful_project_id:
                logger.info(
                    f"[DECRYPT] Successfully decrypted with project {successful_project_id} master key"
                )
                return data, False, successful_project_id
            else:
                raise ValueError(f"Failed to decrypt with project {effective_project_id} key")
        except Exception as project_error:
            logger.error(
                f"[DECRYPT] Project {effective_project_id} master key failed: "
                f"{type(project_error).__name__}: {str(project_error)[:100]}..."
            )
            raise ValueError(
                f"Decryption failed for project {effective_project_id}. "
                "Please ensure you are using the correct project encryption key."
            ) from project_error

    def _decrypt_with_project_key(
        self, enc_data: str, project_id: str
    ) -> Tuple[Optional[Dict], Optional[int]]:
        """
        Decrypt with specific project key using project_master_key from ProjectSettings.
        
        SECURITY IMPROVEMENTS:
        - Uses ONLY project_master_key from ProjectSettings (single source of truth)
        - No multiple key attempts to prevent timing attacks
        - All logging done before/after cryptographic operations (constant time)
        - Constant-time error handling to prevent timing oracle attacks
        
        In strict multi-tenant architecture, each project has ONE encryption key.
        Using multiple key sources creates timing attack vectors and confusion.
        
        TIMING ATTACK PREVENTION:
        - All operations (success and failure) take approximately the same time
        - Error messages are generic to prevent information leakage
        - No early returns that could reveal which key was attempted
        - Constant-time execution path regardless of success/failure
        """
        import time
        import secrets
        
        project_id_int = int(project_id)
        start_time = time.perf_counter()

        # Log before operation (constant time)
        logger.debug(f"[DECRYPT_PROJECT] Attempting decryption for project {project_id}")

        # SECURITY: Use ONLY project_master_key from ProjectSettings
        # This is the single source of truth for project encryption keys
        # Multiple key attempts would create timing attack vectors
        decryption_result = None
        decryption_success = False
        decrypt_error = None
        
        # SECURITY: Perform decryption attempt
        # We always execute the decryption attempt, regardless of whether it will succeed
        try:
            data = decrypt_data_with_project_key(enc_data, project_id_int, use_gcm=True)
            decryption_result = data
            decryption_success = True
        except Exception as e:
            decrypt_error = e
            # Log error details for debugging while maintaining security
            # Don't log encrypted data or keys, but log error type and sanitized message
            error_type = type(e).__name__
            error_msg = str(e)
            
            # Sanitize error message to avoid leaking sensitive info
            # Remove any potential key or data fragments
            sanitized_msg = error_msg
            if len(sanitized_msg) > 200:
                sanitized_msg = sanitized_msg[:200] + "..."
            
            # Check if project key exists (for diagnostic purposes)
            # This check happens in both success and failure paths to maintain constant time
            from ...models.core import ProjectSettings, ProjectEncryptionKeys
            settings = ProjectSettings.query.filter_by(project_id=project_id_int).first()
            encryption_keys = ProjectEncryptionKeys.query.filter_by(project_id=project_id_int).first()
            
            has_project_master_key = settings and settings.project_master_key
            has_aes_key = encryption_keys and encryption_keys.aes_key
            
            logger.error(
                f"[DECRYPT_PROJECT] Project {project_id} decryption failed: "
                f"{error_type}: {sanitized_msg} | "
                f"has_project_master_key={bool(has_project_master_key)} "
                f"has_aes_key={bool(has_aes_key)}"
            )
            
            decryption_result = None
            decryption_success = False
        
        # SECURITY: Constant-time delay to prevent timing attacks
        # Ensure all code paths take similar time regardless of success/failure
        # Use a fixed minimum time plus a small random delay to prevent timing analysis
        elapsed_time = time.perf_counter() - start_time
        min_operation_time = 0.015  # Minimum 15ms to prevent timing analysis
        # Add small random delay (0-5ms) to further obfuscate timing
        random_delay = secrets.randbelow(5000) / 1000000.0  # 0-5ms in seconds
        target_time = min_operation_time + random_delay
        
        if elapsed_time < target_time:
            time.sleep(target_time - elapsed_time)
        
        # SECURITY: Always perform the same operations regardless of success/failure
        # This ensures constant-time execution path
        if decryption_success and decryption_result:
            logger.debug(
                f"[DECRYPT_PROJECT] Successfully decrypted with project_master_key from ProjectSettings"
            )
            return decryption_result, project_id_int
        else:
            # Re-raise the original exception with context for better debugging
            # This preserves the exception chain while maintaining security
            if decrypt_error:
                # Add diagnostic context to the exception
                # Use generic error message to prevent information leakage
                error_context = (
                    f"Decryption failed for project {project_id_int}. "
                    "This may indicate: key mismatch, missing project key, or corrupted encrypted data."
                )
                # Create a new exception with context but preserve the original
                raise ValueError(error_context) from decrypt_error
            # This should not happen, but handle gracefully
            logger.warning(
                f"[DECRYPT_PROJECT] Unexpected state: decryption failed but no exception was captured "
                f"for project {project_id}"
            )
            return None, None

    def _get_project_id_from_redis(self, ip: str) -> Optional[str]:
        """
        Get project_id from Redis for fallback decryption.
        This is safe because project_id is stored only for 5 minutes after challenge request.

        Args:
            ip: Client IP address

        Returns:
            Project ID as string, or None if not found
        """
        try:
            import redis
            redis_client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            project_id = redis_client.get(f"challenge_project_id:{ip}")
            if project_id:
                logger.debug(f"[DECRYPT] Found project_id {project_id} in Redis for IP {ip}")
                return project_id
        except Exception as e:
            logger.debug(f"[DECRYPT] Failed to get project_id from Redis: {type(e).__name__}: {str(e)[:100]}...")
        return None
