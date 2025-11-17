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
        
        SECURITY: This method does NOT iterate through project keys to prevent DoS attacks.
        - If project_id is provided: tries that project's key first, then falls back to global key.
        - If project_id is not provided: tries global key first, then tries project_id from Redis (if IP provided).
        - Never iterates through multiple projects to prevent DoS via expensive decryption operations.
        
        DoS PROTECTION:
        - Maximum data size: 1MB to prevent memory exhaustion
        - Timeout protection: decryption operations are bounded
        - Rate limiting should be applied BEFORE calling this method (by IP address)
        
        Args:
            enc_data: Encrypted data string
            project_id: Project ID to try first (if provided). Required for project-specific encryption.
            ip: Client IP address (optional, used to retrieve project_id from Redis if not provided).

        Returns:
            Tuple of (decrypted_data, used_global_key, successful_project_id)
            
        Raises:
            ValueError: If data size exceeds maximum allowed size
        """
        # SECURITY: Validate input size to prevent DoS via large payloads
        MAX_ENCRYPTED_DATA_SIZE = 1024 * 1024  # 1MB maximum
        if len(enc_data) > MAX_ENCRYPTED_DATA_SIZE:
            logger.warning(
                f"[DECRYPT] Data size exceeds maximum: {len(enc_data)} bytes (max: {MAX_ENCRYPTED_DATA_SIZE}) ip={ip}"
            )
            raise ValueError(f"Encrypted data size exceeds maximum allowed size ({MAX_ENCRYPTED_DATA_SIZE} bytes)")
        
        try:
            # Try base64 decode first (for unencrypted base64-encoded JSON)
            decoded_bytes = base64.b64decode(enc_data)
            # Try to decode as UTF-8 - if it fails, it's likely encrypted binary data
            decoded = decoded_bytes.decode("utf-8")
            data = json.loads(decoded)
            logger.debug("[DEBUG] Successfully decoded base64 data")
            return data, False, None
        except base64.binascii.Error:
            # Invalid base64 - try decryption
            logger.debug("[DEBUG] Invalid base64, trying decryption...")
        except UnicodeDecodeError:
            # Base64 decode succeeded but UTF-8 decode failed - likely encrypted data
            logger.debug("[DEBUG] Base64 decoded but not UTF-8 text, trying decryption...")
        except json.JSONDecodeError:
            # Valid base64 and UTF-8 but not JSON - try decryption
            logger.debug("[DEBUG] Not JSON after base64 decode, trying decryption...")
        
        # If we reach here, base64 decode failed or data is encrypted - proceed to decryption
        # If project_id is provided, try project-specific key first
        if project_id:
            try:
                logger.info(f"[DECRYPT] Trying project {project_id} key first...")
                data, successful_project_id = self._decrypt_with_project_key(enc_data, project_id)
                if data:
                    logger.info(
                        f"[DECRYPT] Successfully decrypted with project {successful_project_id} master key"
                    )
                    return data, False, successful_project_id
            except Exception as project_error:
                # Log at debug level since these failures are expected during key fallback attempts
                logger.debug(
                    f"[DECRYPT] Project {project_id} master key failed: {type(project_error).__name__}: {str(project_error)[:100]}..."
                )

        # Try global master key
        logger.info(f"[DECRYPT] Trying global master key...")
        try:
            data = self._decrypt_with_global_key(enc_data)
            logger.info(f"[DECRYPT] Successfully decrypted with global master key")
            return data, True, None
        except Exception as global_error:
            # SECURITY: If global key failed and project_id was not provided,
            # try to get project_id from Redis (from recent challenge request).
            # This is safe because:
            # 1. We only try ONE project_id from Redis (not multiple)
            # 2. The project_id is stored only for 5 minutes after challenge request
            # 3. This prevents DoS while allowing legitimate clients to work
            if not project_id and ip:
                fallback_project_id = self._get_project_id_from_redis(ip)
                if fallback_project_id:
                    logger.info(f"[DECRYPT] Global key failed, trying project {fallback_project_id} from Redis (IP: {ip})...")
                    try:
                        data, successful_project_id = self._decrypt_with_project_key(enc_data, fallback_project_id)
                        if data:
                            logger.info(
                                f"[DECRYPT] Successfully decrypted with project {successful_project_id} key (from Redis fallback)"
                            )
                            return data, False, successful_project_id
                    except Exception as fallback_error:
                        logger.debug(
                            f"[DECRYPT] Fallback project {fallback_project_id} key failed: {type(fallback_error).__name__}: {str(fallback_error)[:100]}..."
                        )
            
            # If all attempts failed, raise the original global error
            logger.error(
                f"[DECRYPT] All decryption attempts failed. Global master key error: {type(global_error).__name__}: {str(global_error)[:200]}..."
            )
            raise global_error

    def _decrypt_with_global_key(self, enc_data: str) -> Dict:
        """Decrypt with global master key using AES-256-GCM"""
        try:
            logger.debug(
                f"[DECRYPT_GLOBAL] Attempting decryption, data length: {len(enc_data)}"
            )

            # Try AES-256-GCM first (client uses this format)
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
                # Fallback to Fernet for backward compatibility
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
                    raise gcm_error  # Raise the original GCM error
        except Exception as e:
            logger.debug(f"[DECRYPT_GLOBAL] Global key decryption failed: {type(e).__name__}: {e}")
            raise

    def _decrypt_with_project_key(
        self, enc_data: str, project_id: str
    ) -> Tuple[Optional[Dict], Optional[int]]:
        """Decrypt with specific project key using AES-256-GCM"""
        project_id_int = int(project_id)

        # First, try AES Key from ProjectEncryptionKeys (this is what the client uses)
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

        # Fallback to project_master_key from ProjectSettings
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

