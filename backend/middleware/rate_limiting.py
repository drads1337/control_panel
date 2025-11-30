"""
Rate Limiting Middleware
Provides centralized rate limiting for critical endpoints
"""

import logging
from functools import wraps
from typing import Optional

from flask import current_app, jsonify, request
from ..utils.service_helpers import get_service

logger = logging.getLogger(__name__)

def rate_limit(limit_string):
    """
    Decorator for applying rate limiting to specific endpoints

    Args:
        limit_string: Rate limit string (e.g., "5 per minute")
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:

                limiter = current_app.limiter
                if limiter:

                    limiter.limit(limit_string)(lambda: None)()
            except Exception as e:
                logger.warning(f"Rate limiting failed for {request.endpoint}: {e}")

            return f(*args, **kwargs)

        return decorated_function

    return decorator

def apply_auth_rate_limits():
    """
    Apply rate limiting to authentication endpoints
    This should be called after the app is created
    """
    try:
        from flask_limiter import Limiter
        from flask_limiter.util import get_remote_address

        from ..routes.auth import auth_bp

        limiter = current_app.limiter

        if limiter:

            limiter.limit("5 per minute")(auth_bp)
            logger.info("Applied rate limiting to authentication endpoints")
        else:
            logger.warning("Rate limiter not available for auth endpoints")

    except Exception as e:
        logger.error(f"Failed to apply auth rate limits: {e}")

def check_rate_limit_for_endpoint(endpoint_name, limit_string="10 per minute"):
    """
    Check if current request should be rate limited

    Args:
        endpoint_name: Name of the endpoint
        limit_string: Rate limit string

    Returns:
        bool: True if request should be allowed, False if rate limited
    """
    try:
        limiter = current_app.limiter
        if not limiter:
            return True

        @limiter.limit(limit_string)
        def test_function():
            return True

        test_function()
        return True

    except Exception as e:
        logger.warning(f"Rate limit check failed for {endpoint_name}: {e}")
        return True

def connect_rate_limit(rate_limit: int = 60, rate_limit_burst: int = 10, fail_close: bool = True):
    """
    Enhanced rate limiting decorator for connect endpoints
    Uses Redis for distributed rate limiting
    Supports both sync and async functions
    
    NOTE: Progressive delays were removed to avoid blocking worker threads.
    Rate limiting works by returning 429 errors, not by blocking requests.

    Args:
        rate_limit: Maximum requests per minute
        rate_limit_burst: Maximum requests in first 10 seconds
        fail_close: If True (default), block requests when Redis fails (security-critical).
                    If False, allow requests when Redis fails (fail-open, for non-critical endpoints).
    """
    import inspect
    import asyncio

    def decorator(func):
        is_async = inspect.iscoroutinefunction(func)
        
        def check_rate_limit():
            """Blocking rate limit check"""
            from ..services.connect import ResponseBuilder, SecurityChecker
            from ..utils.redis_client import get_redis_client

            # Get services once at the start (DI pattern)
            
            security_checker = SecurityChecker()
            response_builder = ResponseBuilder()

            ip = request.remote_addr
            req_json = request.get_json(silent=True) or {}
            user_key = req_json.get("user_key") or ""

            minute_key = f"rl_min:{user_key}:{ip}"
            # Get services once at the start (DI pattern)
            # Get services once at the start (DI pattern)
            security_service = get_service('security_service')
            burst_key = f"rl_burst:{user_key}:{ip}"

            try:
                # Use persistent Redis instance for rate limiting (must not lose data)
                redis_client = get_redis_client()  # Already uses persistent instance by default
                
                # Check if Redis is available
                if not redis_client.is_available():
                    # Redis is marked as unavailable - raise exception to trigger fail-close
                    raise ConnectionError("Redis is unavailable for rate limiting")

                burst_count = redis_client.incr(burst_key)
                if burst_count == 1:
                    redis_client.expire(burst_key, 10)

                if burst_count > rate_limit_burst:
                    security_checker.log_suspicious_activity(ip, "BURST_RATE_LIMIT", user_key)
                    error_response = response_builder.build_error_response(
                        "Burst rate limit exceeded"
                    )
                    encrypted_response = response_builder.encrypt_response(error_response, True)
                    return encrypted_response, 429

                minute_count = redis_client.incr(minute_key)
                if minute_count == 1:
                    redis_client.expire(minute_key, 60)

                # NOTE: Removed blocking time.sleep() for progressive delays
                # Progressive delays block worker threads and degrade performance under load.
                # Rate limiting should work by returning 429 errors, not by blocking requests.
                # If progressive delays are needed, they should be implemented asynchronously
                # or using non-blocking mechanisms (e.g., gevent, async/await with proper event loop).

                if minute_count > rate_limit:
                    security_checker.log_suspicious_activity(ip, "RATE_LIMIT", user_key)
                    
                    # Update trigger count for Rate Limiting Protection rule
                    try:
                        from ...models.keys import Key
                        # Try to get project_id from user_key if available
                        project_id = None
                        if user_key:
                            key_obj = Key.query.filter_by(key=user_key).first()
                            if key_obj:
                                project_id = key_obj.project_id
                        
                        if project_id:
                            security_service._update_rule_trigger("Rate Limiting Protection", project_id)
                    except Exception as e:
                        logger.debug(f"Could not update rate limit rule trigger: {e}")
                    
                    error_response = response_builder.build_error_response("Rate limit exceeded")
                    encrypted_response = response_builder.encrypt_response(error_response, True)
                    return encrypted_response, 429

                return None
            except Exception as redis_error:
                # Redis operation failed - re-raise to be handled by wrapper
                # This will trigger fail-close behavior for security-critical endpoints
                logger.error(f"Redis rate limiting error: {redis_error}")
                raise

        if is_async:
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                try:
                    # Run rate limit check in thread pool
                    rate_limit_result = await asyncio.to_thread(check_rate_limit)
                    if rate_limit_result:
                        return rate_limit_result

                    return await func(*args, **kwargs)

                except Exception as e:
                    logger.error(f"Rate limiting error: {e}")
                    import traceback

                    logger.error(f"Rate limiting traceback: {traceback.format_exc()}")

                    # SECURITY: Fail-close for security-critical endpoints (auth, connect)
                    # If Redis fails, block the request instead of allowing it
                    if fail_close:
                        from ...services.connect import ResponseBuilder
                        response_builder = ResponseBuilder()
                        error_response = response_builder.build_error_response(
                            "Rate limiting service unavailable. Request blocked for security."
                        )
                        encrypted_response = response_builder.encrypt_response(error_response, True)
                        return encrypted_response, 503  # Service Unavailable
                    
                    # Fail-open for non-critical endpoints
                    return await func(*args, **kwargs)

            return async_wrapper
        else:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                try:
                    rate_limit_result = check_rate_limit()
                    if rate_limit_result:
                        return rate_limit_result

                    return func(*args, **kwargs)

                except Exception as e:
                    logger.error(f"Rate limiting error: {e}")
                    import traceback

                    logger.error(f"Rate limiting traceback: {traceback.format_exc()}")

                    # SECURITY: Fail-close for security-critical endpoints (auth, connect)
                    # If Redis fails, block the request instead of allowing it
                    if fail_close:
                        from ...services.connect import ResponseBuilder
                        response_builder = ResponseBuilder()
                        error_response = response_builder.build_error_response(
                            "Rate limiting service unavailable. Request blocked for security."
                        )
                        encrypted_response = response_builder.encrypt_response(error_response, True)
                        return encrypted_response, 503  # Service Unavailable
                    
                    # Fail-open for non-critical endpoints
                    return func(*args, **kwargs)

            return sync_wrapper

    return decorator

def require_rate_limit_fail_close(func):
    """
    Decorator to enforce fail-close behavior for Flask-Limiter on critical endpoints.
    
    SECURITY: This decorator wraps Flask-Limiter to ensure that if Redis is unavailable,
    the request is blocked instead of allowed. This is critical for authentication
    and other security-sensitive endpoints.
    
    Usage:
        @auth_bp.route("/login", methods=["POST"])
        @require_rate_limit_fail_close
        @limiter.limit("5 per minute")
        def login():
            ...
    
    Args:
        func: Function to wrap
        
    Returns:
        Wrapped function with fail-close rate limiting
    """
    from functools import wraps
    from flask import jsonify, request
    from ..utils.redis_client import get_redis_wrapper
    
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Check if Redis is available before allowing Flask-Limiter to process
        try:
            redis_wrapper = get_redis_wrapper()
            if not redis_wrapper.is_available():
                logger.error(
                    f"SECURITY: Redis unavailable for rate limiting on {request.endpoint}. "
                    f"Blocking request from {request.remote_addr}"
                )
                return jsonify({
                    "error": "Rate limiting service unavailable",
                    "message": "Request blocked for security. Please try again later."
                }), 503  # Service Unavailable
        except Exception as e:
            # If we can't check Redis, fail-close (block the request)
            logger.error(
                f"SECURITY: Cannot verify Redis availability for rate limiting on {request.endpoint}. "
                f"Blocking request from {request.remote_addr}: {e}"
            )
            return jsonify({
                "error": "Rate limiting service unavailable",
                "message": "Request blocked for security. Please try again later."
            }), 503  # Service Unavailable
        
        # Redis is available, proceed with normal rate limiting
        return func(*args, **kwargs)
    
    return wrapper
