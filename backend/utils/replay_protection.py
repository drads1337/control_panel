"""
Replay Protection Module
Prevents replay attacks by tracking used nonces and response IDs.

SECURITY FEATURES:
1. Nonce tracking - each nonce can only be used once
2. Response ID tracking - prevents response replay
3. Time-based expiration - old entries automatically expire
4. Per-user and per-project isolation
"""

import logging
import time
from typing import Tuple, Optional

from ..config.config import Config

logger = logging.getLogger(__name__)

# TTL for nonce tracking (seconds)
NONCE_TTL = int(Config.NONCE_TTL) if hasattr(Config, 'NONCE_TTL') else 300
RESPONSE_ID_TTL = 600  # 10 minutes for response IDs


def check_nonce_replay(nonce: str, user_key: str) -> Tuple[bool, str]:
    """
    Check if nonce has been used before (replay attack).
    
    SECURITY: Each nonce should only be used once per user_key.
    If nonce was seen before, it's a potential replay attack.
    
    Args:
        nonce: Request nonce
        user_key: User key
        
    Returns:
        Tuple of (is_replay, error_message)
    """
    if not nonce:
        # No nonce provided - not a replay but could be legacy client
        return False, ""
    
    try:
        from .redis_client import get_redis_client
        
        redis_client = get_redis_client()
        
        # Key format: nonce:{user_key_prefix}:{nonce}
        # Use prefix of user_key to avoid very long keys
        user_key_prefix = user_key[:16] if len(user_key) > 16 else user_key
        nonce_key = f"nonce:{user_key_prefix}:{nonce}"
        
        # Try to set the nonce with NX (only if not exists)
        # Returns True if set successfully (nonce is new), False if already exists
        was_set = redis_client.set(nonce_key, "1", nx=True, ex=NONCE_TTL)
        
        if not was_set:
            # Nonce already exists - replay attack!
            logger.warning(
                f"NONCE_REPLAY_DETECTED user_key={user_key_prefix}... nonce={nonce[:16]}..."
            )
            return True, "Request replay detected: nonce already used"
        
        # Nonce is new, request is valid
        return False, ""
        
    except Exception as e:
        logger.error(f"Nonce replay check error: {e}")
        # Fail open for availability, but log the error
        return False, ""


def mark_response_id_used(response_id: str, project_id: Optional[int] = None) -> bool:
    """
    Mark response ID as used to prevent response replay.
    
    SECURITY: Each response ID is unique and can only be sent once.
    This prevents attackers from replaying captured responses.
    
    Args:
        response_id: Unique response ID
        project_id: Optional project ID for isolation
        
    Returns:
        True if marked successfully
    """
    if not response_id:
        return False
    
    try:
        from .redis_client import get_redis_client
        
        redis_client = get_redis_client()
        
        # Key format: response_id:{project_id}:{response_id}
        project_prefix = str(project_id) if project_id else "global"
        response_key = f"response_id:{project_prefix}:{response_id}"
        
        # Set with expiration
        redis_client.setex(response_key, RESPONSE_ID_TTL, str(int(time.time())))
        
        return True
        
    except Exception as e:
        logger.error(f"Response ID marking error: {e}")
        return False


def verify_response_id_fresh(response_id: str, project_id: Optional[int] = None) -> Tuple[bool, str]:
    """
    Verify that response ID hasn't been seen before.
    
    Args:
        response_id: Response ID to verify
        project_id: Optional project ID
        
    Returns:
        Tuple of (is_fresh, error_message)
    """
    if not response_id:
        return True, ""
    
    try:
        from .redis_client import get_redis_client
        
        redis_client = get_redis_client()
        
        project_prefix = str(project_id) if project_id else "global"
        response_key = f"response_id:{project_prefix}:{response_id}"
        
        exists = redis_client.exists(response_key)
        
        if exists:
            logger.warning(
                f"RESPONSE_REPLAY_DETECTED project={project_prefix} response_id={response_id[:16]}..."
            )
            return False, "Response replay detected"
        
        return True, ""
        
    except Exception as e:
        logger.error(f"Response ID verification error: {e}")
        return True, ""


def get_replay_protection_stats(project_id: Optional[int] = None) -> dict:
    """
    Get replay protection statistics for monitoring.
    
    Args:
        project_id: Optional project ID to filter by
        
    Returns:
        Dictionary with statistics
    """
    try:
        from .redis_client import get_redis_client
        
        redis_client = get_redis_client()
        
        # Count nonce keys
        nonce_pattern = f"nonce:*"
        nonce_count = 0
        for _ in redis_client.scan_iter(match=nonce_pattern, count=100):
            nonce_count += 1
            if nonce_count >= 1000:  # Limit for performance
                break
        
        # Count response ID keys
        if project_id:
            response_pattern = f"response_id:{project_id}:*"
        else:
            response_pattern = "response_id:*"
        
        response_count = 0
        for _ in redis_client.scan_iter(match=response_pattern, count=100):
            response_count += 1
            if response_count >= 1000:
                break
        
        return {
            "nonce_entries": nonce_count,
            "response_id_entries": response_count,
            "nonce_ttl": NONCE_TTL,
            "response_id_ttl": RESPONSE_ID_TTL
        }
        
    except Exception as e:
        logger.error(f"Replay protection stats error: {e}")
        return {"error": str(e)}
