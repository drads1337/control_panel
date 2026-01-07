"""
Replay Protection Utility
Prevents replay attacks by tracking used nonces and response IDs in Redis
"""

import logging
from typing import Optional

from ..config.config import Config

logger = logging.getLogger(__name__)


class ReplayProtection:
    """
    Handles replay protection for requests and responses.
    
    SECURITY: This class prevents replay attacks by:
    1. Tracking used nonces in requests (prevents request replay)
    2. Tracking used response_ids in responses (prevents response replay)
    3. Using Redis with TTL for automatic cleanup
    """
    
    def __init__(self):
        self.nonce_ttl = 300  # 5 minutes
        self.response_id_ttl = 3600  # 1 hour (responses can be cached longer)
    
    def _get_redis_client(self):
        """Get Redis client for replay protection"""
        try:
            import redis
            from ..utils.redis_client import get_redis_wrapper
            
            redis_wrapper = get_redis_wrapper()
            if redis_wrapper.is_available():
                return redis_wrapper
            return None
        except Exception as e:
            logger.warning(f"Failed to get Redis client for replay protection: {e}")
            return None
    
    def check_nonce_replay(self, nonce: str, user_key: Optional[str] = None) -> tuple[bool, str]:
        """
        Check if nonce has been used before (replay attack detection).
        
        SECURITY: This prevents attackers from reusing captured requests.
        Each nonce can only be used once within the TTL window.
        
        Args:
            nonce: Nonce value from request
            user_key: Optional user key for better isolation
            
        Returns:
            Tuple of (is_replay, error_message)
            - is_replay=True means this is a replay attack
            - is_replay=False means nonce is valid
        """
        if not nonce:
            return False, ""  # Nonce is optional, skip if not provided
        
        redis_wrapper = self._get_redis_client()
        if not redis_wrapper:
            # If Redis is unavailable, log warning but allow request
            # (fail-open to prevent DoS if Redis is down)
            logger.warning("Redis unavailable for nonce replay check, allowing request")
            return False, ""
        
        try:
            # Use user_key for better isolation if available
            if user_key:
                key = f"nonce:{user_key}:{nonce}"
            else:
                key = f"nonce:{nonce}"
            
            # Check if nonce exists
            exists = redis_wrapper.exists(key)
            if exists:
                logger.warning(f"REPLAY_ATTACK_DETECTED: Nonce {nonce[:16]}... already used")
                return True, "Request replay detected: nonce already used"
            
            # Store nonce with TTL
            redis_wrapper.setex(key, self.nonce_ttl, "1")
            return False, ""
            
        except Exception as e:
            logger.error(f"Error checking nonce replay: {e}")
            # Fail-open: if Redis fails, allow request to prevent DoS
            return False, ""
    
    def check_response_id_replay(self, response_id: str, project_id: Optional[int] = None) -> tuple[bool, str]:
        """
        Check if response_id has been used before (response replay detection).
        
        SECURITY: This prevents attackers from reusing captured responses.
        Each response_id can only be used once within the TTL window.
        
        Args:
            response_id: Response ID from server response
            project_id: Optional project ID for better isolation
            
        Returns:
            Tuple of (is_replay, error_message)
            - is_replay=True means this is a replay attack
            - is_replay=False means response_id is valid
        """
        if not response_id:
            return False, ""  # Response ID is optional for backward compatibility
        
        redis_wrapper = self._get_redis_client()
        if not redis_wrapper:
            # If Redis is unavailable, log warning but allow response
            logger.warning("Redis unavailable for response_id replay check, allowing response")
            return False, ""
        
        try:
            # Use project_id for better isolation if available
            if project_id:
                key = f"response_id:{project_id}:{response_id}"
            else:
                key = f"response_id:{response_id}"
            
            # Check if response_id exists
            exists = redis_wrapper.exists(key)
            if exists:
                logger.warning(f"RESPONSE_REPLAY_DETECTED: Response ID {response_id[:16]}... already used")
                return True, "Response replay detected: response_id already used"
            
            # Store response_id with TTL
            redis_wrapper.setex(key, self.response_id_ttl, "1")
            return False, ""
            
        except Exception as e:
            logger.error(f"Error checking response_id replay: {e}")
            # Fail-open: if Redis fails, allow response to prevent DoS
            return False, ""
    
    def mark_response_id_used(self, response_id: str, project_id: Optional[int] = None) -> None:
        """
        Mark response_id as used (called when response is sent to client).
        
        This is a convenience method that does the same as check_response_id_replay
        but doesn't return a boolean. Use this when you want to proactively mark
        a response_id as used.
        
        Args:
            response_id: Response ID to mark as used
            project_id: Optional project ID for better isolation
        """
        if not response_id:
            return
        
        redis_wrapper = self._get_redis_client()
        if not redis_wrapper:
            return
        
        try:
            if project_id:
                key = f"response_id:{project_id}:{response_id}"
            else:
                key = f"response_id:{response_id}"
            
            redis_wrapper.setex(key, self.response_id_ttl, "1")
        except Exception as e:
            logger.error(f"Error marking response_id as used: {e}")


# Global instance
_replay_protection = ReplayProtection()


def check_nonce_replay(nonce: str, user_key: Optional[str] = None) -> tuple[bool, str]:
    """Check if nonce has been used before (replay attack detection)"""
    return _replay_protection.check_nonce_replay(nonce, user_key)


def check_response_id_replay(response_id: str, project_id: Optional[int] = None) -> tuple[bool, str]:
    """Check if response_id has been used before (response replay detection)"""
    return _replay_protection.check_response_id_replay(response_id, project_id)


def mark_response_id_used(response_id: str, project_id: Optional[int] = None) -> None:
    """Mark response_id as used"""
    _replay_protection.mark_response_id_used(response_id, project_id)

