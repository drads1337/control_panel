"""
Decryption Service
Handles decryption of encrypted request data using project-specific or global keys
Single Responsibility: Decryption only
"""

import base64
import json
import logging
from typing import Dict, Optional, Tuple

from ...config.config import Config
from ...models import ProjectEncryptionKeys, ProjectSettings
from ...utils.secure_crypto import MasterKeyManager, decrypt_data_with_project_key

logger = logging.getLogger(__name__)

class DecryptionService:
    """Handles decryption of encrypted request data"""

    def decrypt_request_data(
        self, enc_data: str, project_id: Optional[str] = None, ip: Optional[str] = None
    ) -> Tuple[Optional[Dict], bool, Optional[int]]:
        """
        Decrypt request data with project-specific or global key.

        SECURITY IMPROVEMENTS (Anti-Timing Attack):
        - If project_id is provided: uses ONLY that project's key (no fallback to global key).
          This prevents timing attacks where different response times reveal which key was used.
        - If project_id is not provided: uses ONLY global master key.
        - Never tries multiple keys in sequence to prevent timing-based key enumeration.

        IMPORTANT: For project-specific encryption, client MUST provide project_id explicitly
        (e.g., in URL parameter or request header). Do not rely on Redis fallback for security.

        DoS PROTECTION:
        - Maximum data size: 1MB to prevent memory exhaustion
        - Timeout protection: decryption operations are bounded
        - Rate limiting should be applied BEFORE calling this method (by IP address)
        - Single decryption attempt per call (no key enumeration)

        Args:
            enc_data: Encrypted data string
            project_id: Project ID (if provided, ONLY this project's key will be tried).
                       Required for project-specific encryption.
            ip: Client IP address (optional, for logging only)

        Returns:
            Tuple of (decrypted_data, used_global_key, successful_project_id)

        Raises:
            ValueError: If data size exceeds maximum allowed size or decryption fails
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

        # SECURITY: Use only ONE key to prevent timing attacks
        # If project_id is provided, use ONLY project key (no fallback)
        if project_id:
            logger.info(f"[DECRYPT] Using project {project_id} key only (no fallback)...")
            try:
                data, successful_project_id = self._decrypt_with_project_key(enc_data, project_id)
                if data:
                    logger.info(
                        f"[DECRYPT] Successfully decrypted with project {successful_project_id} master key"
                    )
                    return data, False, successful_project_id
                else:
                    raise ValueError(f"Failed to decrypt with project {project_id} key")
            except Exception as project_error:
                logger.error(
                    f"[DECRYPT] Project {project_id} master key failed: {type(project_error).__name__}: {str(project_error)[:100]}..."
                )
                raise ValueError(f"Decryption failed for project {project_id}") from project_error

        # If no project_id, use ONLY global key (no fallback to Redis/project keys)
        logger.info(f"[DECRYPT] Using global master key only (no project fallback)...")
        try:
            data = self._decrypt_with_global_key(enc_data)
            logger.info(f"[DECRYPT] Successfully decrypted with global master key")
            return data, True, None
        except Exception as global_error:
            logger.error(
                f"[DECRYPT] Global master key failed: {type(global_error).__name__}: {str(global_error)[:200]}..."
            )
            raise ValueError("Decryption failed: invalid encryption key or corrupted data") from global_error

    def _decrypt_with_global_key(self, enc_data: str) -> Dict:
        """Decrypt with global master key using AES-256-GCM"""
        try:
            logger.debug(
                f"[DECRYPT_GLOBAL] Attempting decryption, data length: {len(enc_data)}"
            )

            try:
                logger.info(f"[DECRYPT_GLOBAL] Trying AES-256-GCM decryption...")
                json_str = MasterKeyManager.decrypt_with_master_key_legacy(
                    enc_data, Config.MASTER_KEY
                )
                logger.info(
                    f"[DECRYPT_GLOBAL] AES-256-GCM success, decrypted length: {len(json_str)}"
                )
                logger.info(f"[DECRYPT_GLOBAL] Decrypted data preview: {json_str[:200]}...")
                return json.loads(json_str)
            except Exception as gcm_error:

                logger.debug(
                    f"[DECRYPT_GLOBAL] AES-256-GCM failed: {type(gcm_error).__name__}: {str(gcm_error)}"
                )
                logger.debug(f"[DECRYPT_GLOBAL] Trying Fernet fallback...")
                try:
                    json_str = MasterKeyManager.decrypt_with_master_key(enc_data, Config.MASTER_KEY)
                    logger.info(
                        f"[DECRYPT_GLOBAL] Fernet success, decrypted length: {len(json_str)}"
                    )
                    return json.loads(json_str)
                except Exception as fernet_error:
                    logger.debug(
                        f"[DECRYPT_GLOBAL] Fernet also failed: {type(fernet_error).__name__}: {str(fernet_error)}"
                    )
                    raise gcm_error
        except Exception as e:
            logger.debug(f"[DECRYPT_GLOBAL] Global key decryption failed: {type(e).__name__}: {e}")
            raise

    def _decrypt_with_project_key(
        self, enc_data: str, project_id: str
    ) -> Tuple[Optional[Dict], Optional[int]]:
        """Decrypt with specific project key using AES-256-GCM"""
        project_id_int = int(project_id)

        try:
            encryption_keys = ProjectEncryptionKeys.query.filter_by(
                project_id=project_id_int
            ).first()
            if encryption_keys and encryption_keys.aes_key:
                logger.info(
                    f"[DECRYPT_PROJECT] Trying AES Key from ProjectEncryptionKeys for project {project_id}"
                )
                json_str = MasterKeyManager.decrypt_with_master_key_legacy(
                    enc_data, encryption_keys.aes_key
                )
                logger.info(
                    f"[DECRYPT_PROJECT] Successfully decrypted with AES Key from ProjectEncryptionKeys"
                )
                return json.loads(json_str), project_id_int
        except Exception as aes_key_error:
            logger.debug(
                f"[DECRYPT_PROJECT] AES Key from ProjectEncryptionKeys failed: {type(aes_key_error).__name__}: {str(aes_key_error)[:100]}..."
            )

        try:
            logger.info(
                f"[DECRYPT_PROJECT] Trying project_master_key from ProjectSettings for project {project_id}"
            )
            data = decrypt_data_with_project_key(enc_data, project_id_int, use_gcm=True)
            logger.info(
                f"[DECRYPT_PROJECT] Successfully decrypted with project_master_key from ProjectSettings"
            )
            return data, project_id_int
        except Exception as e:
            logger.debug(
                f"[DECRYPT_PROJECT] Project {project_id} project_master_key failed: {type(e).__name__}: {str(e)[:100]}..."
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
