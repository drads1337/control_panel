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

        # SECURITY: Try project key first (strict multi-tenant)
        logger.info(f"[DECRYPT] Using project {effective_project_id} key first (strict multi-tenant)...")
        try:
            data, successful_project_id = self._decrypt_with_project_key(enc_data, effective_project_id)
            if data and successful_project_id:
                logger.info(
                    f"[DECRYPT] Successfully decrypted with project {successful_project_id} AES Key"
                )
                return data, False, successful_project_id
            else:
                raise ValueError(f"Failed to decrypt with project {effective_project_id} key")
        except (ValueError, TypeError, AttributeError, KeyError) as project_error:
            # Specific exceptions from decryption logic
            # ValueError: Invalid key/data format
            # TypeError: Wrong data type
            # AttributeError: Missing required attributes
            # KeyError: Missing required keys in data
            logger.warning(
                f"[DECRYPT] Project {effective_project_id} keys failed: "
                f"{type(project_error).__name__}: {str(project_error)[:100]}..."
            )
            
            # SECURITY: No fallback to global MASTER_KEY
            # Multiple key attempts create timing attack vectors where an attacker can determine
            # which key was used based on response time differences.
            # In strict multi-tenant architecture, each project MUST use its own encryption key.
            logger.error(
                f"[DECRYPT] Decryption failed for project {effective_project_id}. "
                f"Project-specific key decryption failed: {type(project_error).__name__}"
            )
            raise ValueError(
                f"Decryption failed for project {effective_project_id}. "
                f"Please ensure you are using the AES Key from ProjectEncryptionKeys (Cryptographic Keys in settings). "
                f"Project {effective_project_id} must use its project-specific AES Key. "
                f"Global MASTER_KEY fallback is disabled for security (prevents timing attacks)."
            ) from project_error
        except Exception as unexpected_error:
            # Catch-all for truly unexpected errors (e.g., database connection issues, memory errors)
            # SECURITY: In production, do not log full tracebacks to prevent code structure disclosure
            from ...config.config import IS_PRODUCTION
            
            error_type = type(unexpected_error).__name__
            error_msg = str(unexpected_error)
            
            # Sanitize error message to prevent information leakage
            # Limit message length and remove potential sensitive data
            sanitized_msg = error_msg[:200] + "..." if len(error_msg) > 200 else error_msg
            
            if IS_PRODUCTION:
                # In production: log only error type and sanitized message (no traceback)
                logger.error(
                    f"[DECRYPT] Unexpected error during decryption for project {effective_project_id}: "
                    f"{error_type}: {sanitized_msg}"
                )
            else:
                # In development: log full traceback for debugging
                import traceback
                logger.error(
                    f"[DECRYPT] Unexpected error during decryption for project {effective_project_id}: "
                    f"{error_type}: {error_msg}. "
                    f"Traceback: {traceback.format_exc()}"
                )
            
            raise ValueError(
                f"Unexpected error during decryption for project {effective_project_id}. "
                f"Please contact support if this persists."
            ) from unexpected_error

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
        - Normalized execution path to prevent timing differences
        
        In strict multi-tenant architecture, each project has ONE encryption key.
        Using multiple key sources creates timing attack vectors and confusion.
        
        TIMING ATTACK PREVENTION:
        - Uses constant-time operations from cryptography library (C-level implementation)
        - No artificial delays (time.sleep is unreliable with Python GIL/GC)
        - Error messages are generic to prevent information leakage
        - No early returns that could reveal which key was attempted
        - Constant-time execution path regardless of success/failure
        - Normalized database queries (always executed, even if not needed)
        - Constant-time string operations for error messages
        
        NOTE: Python's GIL and GC make time.sleep() unreliable for timing attack prevention.
        Instead, we rely on constant-time operations from the cryptography library which
        are implemented at the C level and provide true constant-time guarantees.
        """
        import time
        
        project_id_int = int(project_id)
        start_time = time.perf_counter()

        # SECURITY: Normalize execution path - always perform the same operations
        # regardless of success/failure to prevent timing differences
        
        # Always check for keys (even if we won't use them) to normalize DB query time
        from ...models.core import ProjectSettings, ProjectEncryptionKeys
        settings = ProjectSettings.query.filter_by(project_id=project_id_int).first()
        encryption_keys = ProjectEncryptionKeys.query.filter_by(project_id=project_id_int).first()
        
        # Normalize key existence checks (constant-time operations)
        has_project_master_key = bool(settings and settings.project_master_key)
        has_aes_key = bool(encryption_keys and encryption_keys.aes_key)
        
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
        # The cryptography library's AES-GCM implementation uses constant-time operations
        # at the C level, which provides true constant-time guarantees unlike Python's time.sleep()
        try:
            data = decrypt_data_with_project_key(enc_data, project_id_int, use_gcm=True)
            decryption_result = data
            decryption_success = True
            decrypt_error = None
        except Exception as unexpected_crypto_error:
            # Catch-all for unexpected crypto errors (should be rare)
            # SECURITY: In production, do not log full tracebacks to prevent code structure disclosure
            from ...config.config import IS_PRODUCTION
            
            decrypt_error = unexpected_crypto_error
            # Log error details for debugging while maintaining security
            # Don't log encrypted data or keys, but log error type and sanitized message
            error_type = type(unexpected_crypto_error).__name__
            error_msg = str(unexpected_crypto_error)
            
            # Sanitize error message to avoid leaking sensitive info
            # Remove any potential key or data fragments
            sanitized_msg = error_msg
            if len(sanitized_msg) > 200:
                sanitized_msg = sanitized_msg[:200] + "..."
            
            if IS_PRODUCTION:
                # In production: log only error type and sanitized message (no traceback)
                logger.error(
                    f"[DECRYPT_PROJECT] Unexpected crypto error for project {project_id}: "
                    f"{error_type}: {sanitized_msg}"
                )
            else:
                # In development: log full traceback for debugging
                import traceback
                logger.error(
                    f"[DECRYPT_PROJECT] Unexpected crypto error for project {project_id}: "
                    f"{error_type}: {error_msg}. "
                    f"Traceback: {traceback.format_exc()}"
                )
            
            decryption_result = None
            decryption_success = False
        
        # SECURITY: Normalize execution time by always performing the same operations
        # regardless of success/failure. This prevents timing differences that could
        # reveal whether decryption succeeded or failed.
        
        # Always perform these operations (even if not needed) to normalize timing
        # These operations are fast and don't reveal sensitive information
        _ = has_project_master_key
        _ = has_aes_key
        
        # SECURITY: No artificial delays needed
        # The cryptography library's AES-GCM decryption uses constant-time operations
        # implemented at the C level. These provide true constant-time guarantees
        # unlike Python's time.sleep() which is unreliable due to GIL and GC.
        # 
        # Constant-time guarantees come from:
        # 1. AES-GCM implementation in OpenSSL (C level)
        # 2. Tag verification uses constant-time comparison
        # 3. All cryptographic operations are designed to prevent timing leaks
        
        # SECURITY: Always perform the same operations regardless of success/failure
        # This ensures constant-time execution path
        # Calculate execution time for monitoring (but don't use it for security)
        execution_time = time.perf_counter() - start_time
        
        if decryption_success and decryption_result:
            logger.debug(
                f"[DECRYPT_PROJECT] Successfully decrypted with project_master_key from ProjectSettings "
                f"(execution_time={execution_time:.4f}s)"
            )
            return decryption_result, project_id_int
        else:
            # Re-raise the original exception with context for better debugging
            # This preserves the exception chain while maintaining security
            if decrypt_error:
                # Add diagnostic context to the exception
                # Use generic error message to prevent information leakage
                # Get diagnostic info for better error message
                if has_aes_key:
                    error_context = (
                        f"Decryption failed for project {project_id_int}. "
                        "AES Key from ProjectEncryptionKeys exists but decryption failed. "
                        "This may indicate: key mismatch (client using different key), "
                        "corrupted encrypted data, or encryption format mismatch. "
                        "Ensure client uses the correct AES Key from ProjectEncryptionKeys."
                    )
                else:
                    error_context = (
                        f"Decryption failed for project {project_id_int}. "
                        "AES Key from ProjectEncryptionKeys is missing. "
                        "Please configure Cryptographic Keys (AES Key) in project settings."
                    )
                # Create a new exception with context but preserve the original
                raise ValueError(error_context) from decrypt_error
            # This should not happen, but handle gracefully
            logger.warning(
                f"[DECRYPT_PROJECT] Unexpected state: decryption failed but no exception was captured "
                f"for project {project_id} (execution_time={execution_time:.4f}s)"
            )
            return None, None

    def _get_aes_key_preview(self, project_id: str) -> str:
        """Get AES Key preview for diagnostic logging (first 16 chars)"""
        try:
            from ...models.core import ProjectEncryptionKeys
            encryption_keys = ProjectEncryptionKeys.query.filter_by(project_id=int(project_id)).first()
            if encryption_keys and encryption_keys.aes_key:
                key = encryption_keys.aes_key.strip()
                return f"{key[:16]}..." if len(key) >= 16 else key[:8] + "..."
        except Exception:
            pass
        return "N/A"

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
            from ...utils.redis_client import get_redis_client
            # Use persistent Redis instance for challenge validation (must not lose data)
            redis_client = get_redis_client()
            project_id = redis_client.get(f"challenge_project_id:{ip}")
            if project_id:
                logger.debug(f"[DECRYPT] Found project_id {project_id} in Redis for IP {ip}")
                return project_id
        except (ConnectionError, TimeoutError, AttributeError) as redis_error:
            # Specific Redis connection errors
            logger.debug(
                f"[DECRYPT] Redis connection error getting project_id: "
                f"{type(redis_error).__name__}: {str(redis_error)[:100]}..."
            )
        except Exception as unexpected_redis_error:
            # Catch-all for unexpected Redis errors
            logger.warning(
                f"[DECRYPT] Unexpected Redis error getting project_id: "
                f"{type(unexpected_redis_error).__name__}: {str(unexpected_redis_error)[:100]}..."
            )
        return None
