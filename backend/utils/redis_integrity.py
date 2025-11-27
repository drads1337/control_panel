"""
Redis Data Integrity Protection
Provides HMAC-based integrity verification for critical Redis data.

SECURITY: This module adds proactive protection against Redis tampering by:
- Signing critical data with HMAC before storing in Redis
- Verifying data integrity when reading from Redis
- Detecting unauthorized modifications
- Providing audit trail of integrity violations
"""

import hashlib
import hmac
import json
import logging
import time
from typing import Any, Dict, Optional, Tuple

from .redis_client import get_redis_client

logger = logging.getLogger(__name__)


class RedisIntegrityProtection:
    """
    Provides HMAC-based integrity protection for Redis data.
    
    This class signs critical data before storing it in Redis and verifies
    the signature when reading it back. This prevents unauthorized modifications
    even if an attacker gains access to Redis.
    """
    
    # Critical key patterns that should be protected
    PROTECTED_KEY_PATTERNS = {
        "dynamic_config": "dynamic_config:*",
        "session": "session:*",
        "challenge": "challenge:*",
        "nonce": "nonce:*",
    }
    
    def __init__(self):
        self.signing_key = self._get_signing_key()
        # SECURITY: Redis Integrity Protection is optional.
        # If Redis uses TLS inside VPC (e.g., AWS ElastiCache with TLS),
        # HMAC adds CPU overhead without significant security benefit.
        # Disable if Redis traffic is already encrypted via TLS.
        from ..config.config import Config
        self.protection_enabled = getattr(Config, 'REDIS_INTEGRITY_ENABLED', False)
        
    def _get_signing_key(self) -> bytes:
        """
        Get HMAC signing key from configuration.
        
        SECURITY: The signing key should be:
        - Stored securely (environment variable or secure config)
        - Different from encryption keys
        - Rotated periodically
        
        In production, this MUST fail if MASTER_KEY is not available.
        No fallback keys are allowed in production.
        """
        try:
            from ..config.config import Config, IS_PRODUCTION
            
            # Use MASTER_KEY as base, but derive a separate key for HMAC
            # This ensures HMAC key is different from encryption keys
            if not Config.MASTER_KEY:
                if IS_PRODUCTION:
                    raise RuntimeError(
                        "CRITICAL SECURITY ERROR: MASTER_KEY is required for Redis integrity protection. "
                        "Application cannot start without a secure signing key in production."
                    )
                else:
                    raise RuntimeError(
                        "CRITICAL SECURITY ERROR: MASTER_KEY is required for Redis integrity protection. "
                        "Please set PANEL_MASTER_KEY environment variable."
                    )
            
            key_source = f"{Config.MASTER_KEY}_redis_integrity_salt"
            return hashlib.sha256(key_source.encode()).digest()
        except RuntimeError:
            # Re-raise RuntimeError (our security errors)
            raise
        except Exception as e:
            # For any other exception, fail in production
            from ..config.config import IS_PRODUCTION
            if IS_PRODUCTION:
                raise RuntimeError(
                    f"CRITICAL SECURITY ERROR: Failed to initialize Redis integrity signing key: {e}. "
                    "Application cannot start without a secure signing key in production."
                ) from e
            else:
                # In development, still fail but with clearer message
                raise RuntimeError(
                    f"CRITICAL SECURITY ERROR: Failed to initialize Redis integrity signing key: {e}. "
                    "Please ensure PANEL_MASTER_KEY is set correctly."
                ) from e
    
    def _get_key_pattern(self, key: str) -> str:
        """
        Extract key pattern from a Redis key for monitoring purposes.
        
        Args:
            key: Redis key name
            
        Returns:
            Key pattern (e.g., 'dynamic_config', 'session', 'challenge')
        """
        for pattern_name, pattern in self.PROTECTED_KEY_PATTERNS.items():
            if key.startswith(pattern.replace("*", "")):
                return pattern_name
        return "unknown"
    
    def _should_protect_key(self, key: str) -> bool:
        """
        Check if a key should be protected with HMAC.
        
        Args:
            key: Redis key name
            
        Returns:
            True if key should be protected
        """
        if not self.protection_enabled:
            return False
        
        for pattern_type, pattern in self.PROTECTED_KEY_PATTERNS.items():
            if pattern.replace("*", "") in key or key.startswith(pattern.replace("*", "").split(":")[0]):
                return True
        return False
    
    def sign_data(self, data: str, key: str) -> str:
        """
        Sign data with HMAC before storing in Redis.
        
        Format: {data}|{hmac_signature}
        
        Args:
            data: Data to sign
            key: Redis key name (used in HMAC calculation)
            
        Returns:
            Signed data string
        """
        if not self._should_protect_key(key):
            return data
        
        # Include key name in HMAC to prevent key substitution attacks
        message = f"{key}:{data}".encode("utf-8")
        signature = hmac.new(
            self.signing_key,
            message,
            hashlib.sha256
        ).hexdigest()
        
        # Format: data|signature
        signed_data = f"{data}|{signature}"
        
        logger.debug(f"[REDIS_INTEGRITY] Signed data for key {key} (length: {len(signed_data)})")
        return signed_data
    
    def verify_data(self, signed_data: str, key: str) -> Tuple[bool, Optional[str]]:
        """
        Verify HMAC signature and extract original data.
        
        Args:
            signed_data: Signed data from Redis
            key: Redis key name (used in HMAC verification)
            
        Returns:
            Tuple of (is_valid, original_data)
            - is_valid: True if signature is valid
            - original_data: Original data if valid, None if invalid
        """
        if not self._should_protect_key(key):
            return True, signed_data
        
        # Check if data is signed (contains | separator)
        if "|" not in signed_data:
            logger.warning(
                f"[REDIS_INTEGRITY] Unsigned data detected for protected key {key}"
            )
            return False, None
        
        # Split data and signature
        parts = signed_data.rsplit("|", 1)
        if len(parts) != 2:
            logger.warning(
                f"[REDIS_INTEGRITY] Invalid signed data format for key {key}"
            )
            return False, None
        
        data, signature = parts
        
        # Verify HMAC
        message = f"{key}:{data}".encode("utf-8")
        expected_signature = hmac.new(
            self.signing_key,
            message,
            hashlib.sha256
        ).hexdigest()
        
        # Use constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(signature, expected_signature):
            logger.error(
                f"[REDIS_INTEGRITY] HMAC verification failed for key {key} - "
                f"possible tampering detected"
            )
            
            # Record integrity error for monitoring
            try:
                from ..services.monitoring.buffer_integrity_monitor import get_buffer_integrity_monitor
                monitor = get_buffer_integrity_monitor()
                # Determine key pattern
                key_pattern = self._get_key_pattern(key)
                monitor.record_redis_integrity_error(key_pattern)
                monitor.record_redis_integrity_check(key_pattern, False)
            except Exception as e:
                logger.debug(f"Failed to record integrity error metrics: {e}")
            
            return False, None
        
        logger.debug(f"[REDIS_INTEGRITY] Verified data for key {key}")
        
        # Record successful integrity check
        try:
            from ..services.monitoring.buffer_integrity_monitor import get_buffer_integrity_monitor
            monitor = get_buffer_integrity_monitor()
            key_pattern = self._get_key_pattern(key)
            monitor.record_redis_integrity_check(key_pattern, True)
        except Exception as e:
            logger.debug(f"Failed to record integrity check metrics: {e}")
        
        return True, data
    
    def store_with_integrity(
        self,
        redis_client: Any,
        key: str,
        value: str,
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Store data in Redis with integrity protection.
        
        Args:
            redis_client: Redis client instance
            key: Redis key name
            value: Value to store
            ttl: Optional TTL in seconds
            
        Returns:
            True if stored successfully
        """
        try:
            signed_value = self.sign_data(value, key)
            
            if ttl:
                redis_client.setex(key, ttl, signed_value)
            else:
                redis_client.set(key, signed_value)
            
            logger.debug(f"[REDIS_INTEGRITY] Stored protected data for key {key}")
            return True
        except Exception as e:
            logger.error(
                f"[REDIS_INTEGRITY] Failed to store protected data for key {key}: {e}"
            )
            return False
    
    def get_with_integrity(
        self,
        redis_client: Any,
        key: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Get data from Redis with integrity verification.
        
        Args:
            redis_client: Redis client instance
            key: Redis key name
            
        Returns:
            Tuple of (is_valid, data)
            - is_valid: True if data is valid and not tampered
            - data: Original data if valid, None if invalid or not found
        """
        try:
            signed_value = redis_client.get(key)
            if signed_value is None:
                return True, None  # Key not found (not an integrity issue)
            
            # Decode bytes to string if needed
            if isinstance(signed_value, bytes):
                signed_value = signed_value.decode("utf-8")
            
            return self.verify_data(signed_value, key)
        except Exception as e:
            logger.error(
                f"[REDIS_INTEGRITY] Failed to get protected data for key {key}: {e}"
            )
            return False, None
    
    def check_integrity_batch(
        self,
        key_pattern: str,
        max_keys: int = 100,
    ) -> Dict[str, Any]:
        """
        Check integrity of multiple keys matching a pattern.
        
        Args:
            key_pattern: Pattern to match keys (e.g., "dynamic_config:*")
            max_keys: Maximum number of keys to check
            
        Returns:
            Dictionary with integrity check results
        """
        try:
            redis_client = get_redis_client()
            keys = redis_client.keys(key_pattern)
            
            if len(keys) > max_keys:
                keys = keys[:max_keys]
                logger.warning(
                    f"[REDIS_INTEGRITY] Limiting integrity check to {max_keys} keys "
                    f"(found {len(keys)} total)"
                )
            
            results = {
                "total_keys": len(keys),
                "valid_keys": 0,
                "invalid_keys": 0,
                "unsigned_keys": 0,
                "missing_keys": 0,
                "invalid_key_list": [],
                "timestamp": time.time(),
            }
            
            for key in keys:
                if isinstance(key, bytes):
                    key = key.decode("utf-8")
                
                is_valid, data = self.get_with_integrity(redis_client, key)
                
                if data is None:
                    results["missing_keys"] += 1
                elif not is_valid:
                    results["invalid_keys"] += 1
                    results["invalid_key_list"].append(key)
                else:
                    # Check if key should be protected but isn't signed
                    if self._should_protect_key(key):
                        signed_value = redis_client.get(key)
                        if signed_value and isinstance(signed_value, bytes):
                            signed_value = signed_value.decode("utf-8")
                        if signed_value and "|" not in signed_value:
                            results["unsigned_keys"] += 1
                            results["invalid_key_list"].append(f"{key} (unsigned)")
                        else:
                            results["valid_keys"] += 1
                    else:
                        results["valid_keys"] += 1
            
            if results["invalid_keys"] > 0 or results["unsigned_keys"] > 0:
                logger.error(
                    f"[REDIS_INTEGRITY] Integrity check found issues: "
                    f"invalid={results['invalid_keys']} unsigned={results['unsigned_keys']} "
                    f"keys={results['invalid_key_list'][:10]}"
                )
            
            # Record unsigned keys count for monitoring
            try:
                from ..services.monitoring.buffer_integrity_monitor import get_buffer_integrity_monitor
                monitor = get_buffer_integrity_monitor()
                monitor.record_unsigned_keys(key_pattern, results["unsigned_keys"])
            except Exception as e:
                logger.debug(f"Failed to record unsigned keys metrics: {e}")
            
            return results
        except Exception as e:
            logger.error(f"[REDIS_INTEGRITY] Failed to check integrity batch: {e}")
            return {
                "status": "error",
                "message": str(e),
                "timestamp": time.time(),
            }


# Global instance
redis_integrity_protection = RedisIntegrityProtection()

