import hashlib
import json
import logging
import time
from functools import wraps
from typing import Any, Callable, Dict, Optional, Tuple

from flask import g, jsonify, request
from ..config.config import IS_PRODUCTION
from ..utils.redis_client import get_redis_client_for_db

logger = logging.getLogger(__name__)

IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"

IDEMPOTENCY_REDIS_PREFIX = "idempotency:"

DEFAULT_IDEMPOTENCY_TTL = 86400

MAX_KEY_LENGTH = 255

MIN_KEY_LENGTH = 8

def get_idempotency_key() -> Optional[str]:
    """
    Extract idempotency key from request headers.
    
    Returns:
        Idempotency key if present, None otherwise
    """
    return request.headers.get(IDEMPOTENCY_KEY_HEADER)

def validate_idempotency_key(key: str) -> Tuple[bool, Optional[str]]:
    """
    Validate idempotency key format.
    
    Args:
        key: Idempotency key to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not key:
        return False, "Idempotency key is required"
    
    if len(key) < MIN_KEY_LENGTH:
        return False, f"Idempotency key must be at least {MIN_KEY_LENGTH} characters"
    
    if len(key) > MAX_KEY_LENGTH:
        return False, f"Idempotency key must be at most {MAX_KEY_LENGTH} characters"
    
    if not key.replace("-", "").replace("_", "").isalnum():
        return False, "Idempotency key must contain only alphanumeric characters, hyphens, and underscores"
    
    return True, None

def _get_redis_key(idempotency_key: str, user_id: int, project_id: Optional[int] = None) -> str:
    """
    Generate Redis key for idempotency storage.
    
    SECURITY: Keys are scoped per user and project to prevent cross-tenant access.
    
    Args:
        idempotency_key: Client-provided idempotency key
        user_id: User ID making the request
        project_id: Optional project ID for additional scoping
        
    Returns:
        Redis key string
    """
    key_components = f"{idempotency_key}:{user_id}"
    if project_id:
        key_components += f":{project_id}"
    
    key_hash = hashlib.sha256(key_components.encode()).hexdigest()[:16]
    
    return f"{IDEMPOTENCY_REDIS_PREFIX}{key_hash}:{user_id}"

def _store_idempotency_result(
    redis_key: str,
    response_data: Dict[str, Any],
    status_code: int,
    ttl: int = DEFAULT_IDEMPOTENCY_TTL
) -> bool:
    """
    Store idempotency result in Redis.
    
    Args:
        redis_key: Redis key for storage
        response_data: Response data to store
        status_code: HTTP status code
        ttl: Time to live in seconds
        
    Returns:
        True if stored successfully, False otherwise
    """
    try:
        redis_client = get_redis_client_for_db("cache")
        
        result = {
            "response": response_data,
            "status_code": status_code,
            "timestamp": time.time(),
        }
        
        redis_client.setex(
            redis_key,
            ttl,
            json.dumps(result)
        )
        
        logger.debug(f"IDEMPOTENCY_STORED key={redis_key[:50]}... status={status_code}")
        return True
    except Exception as e:
        logger.error(f"IDEMPOTENCY_STORE_ERROR key={redis_key[:50]}... error={e}")
        return False

def _get_idempotency_result(redis_key: str) -> Optional[Dict[str, Any]]:
    """
    Get cached idempotency result from Redis.
    
    Args:
        redis_key: Redis key to lookup
        
    Returns:
        Cached result dictionary or None if not found
    """
    try:
        redis_client = get_redis_client_for_db("cache")
        cached_data = redis_client.get(redis_key)
        
        if cached_data:
            result = json.loads(cached_data)
            logger.debug(f"IDEMPOTENCY_CACHE_HIT key={redis_key[:50]}...")
            return result
        
        return None
    except Exception as e:
        logger.error(f"IDEMPOTENCY_LOOKUP_ERROR key={redis_key[:50]}... error={e}")
        return None


def require_idempotency(
    ttl: int = DEFAULT_IDEMPOTENCY_TTL,
    required: bool = False
):
    """
    Decorator to add idempotency support to a route handler.
    
    Args:
        ttl: Time to live for idempotency key in seconds (default: 24 hours)
        required: If True, idempotency key is required (default: False, optional)
    
    Usage:
        @require_idempotency(ttl=3600, required=True)
        @route("/api/keys/bulk", methods=["POST"])
        def bulk_create_keys():
            # Operation is automatically idempotent
            ...
    
    Behavior:
        - If idempotency key is provided and found in cache: Returns cached response
        - If idempotency key is provided and not found: Executes operation, caches result
        - If idempotency key is not provided and required=True: Returns 400 error
        - If idempotency key is not provided and required=False: Executes normally
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            idempotency_key = get_idempotency_key()
            
            if required and not idempotency_key:
                return jsonify({
                    "error": "Idempotency-Key header is required for this operation"
                }), 400

            if not idempotency_key:
                return f(*args, **kwargs)
            
            is_valid, error_msg = validate_idempotency_key(idempotency_key)
            if not is_valid:
                return jsonify({
                    "error": f"Invalid idempotency key: {error_msg}"
                }), 400
            
            user_id = getattr(g, "current_user", None)
            if user_id:
                user_id = user_id.id if hasattr(user_id, "id") else user_id
            else:
                try:
                    from flask_jwt_extended import get_jwt_identity
                    user_id = get_jwt_identity()
                except Exception:
                    user_id = None
            
            if not user_id:
                logger.warning("IDEMPOTENCY_NO_USER: Cannot scope idempotency key without user context")
                return f(*args, **kwargs)
            
            project_id = getattr(g, "project_id", None)
            
            redis_key = _get_redis_key(idempotency_key, user_id, project_id)
            
            cached_result = _get_idempotency_result(redis_key)
            if cached_result:
                logger.info(
                    f"IDEMPOTENCY_REPLAY key={idempotency_key[:20]}... "
                    f"user_id={user_id} status={cached_result['status_code']}"
                )
                
                response = jsonify(cached_result["response"])
                response.status_code = cached_result["status_code"]
                
                response.headers["X-Idempotency-Replayed"] = "true"
                response.headers["X-Idempotency-Key"] = idempotency_key[:20] + "..."
                
                return response
            
            try:
                result = f(*args, **kwargs)

                if isinstance(result, tuple):
                    response_data, status_code = result
                else:
                    response_data = result
                    status_code = 200
                if hasattr(response_data, "get_json"):
                    try:
                        response_dict = response_data.get_json()
                    except Exception:
                        response_dict = {"message": "Operation completed"}
                elif isinstance(response_data, dict):
                    response_dict = response_data
                else:
                    response_dict = {"message": "Operation completed"}
                
                if 200 <= status_code < 300:
                    _store_idempotency_result(redis_key, response_dict, status_code, ttl)
                
                if isinstance(result, tuple) and hasattr(result[0], "headers"):
                    result[0].headers["X-Idempotency-Key"] = idempotency_key[:20] + "..."
                elif hasattr(result, "headers"):
                    result.headers["X-Idempotency-Key"] = idempotency_key[:20] + "..."
                
                return result
                
            except Exception as e:
                logger.error(f"IDEMPOTENCY_EXECUTION_ERROR key={idempotency_key[:20]}... error={e}")
                raise
        
        return decorated_function
    return decorator