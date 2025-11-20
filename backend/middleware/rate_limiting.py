"""
Rate Limiting Middleware
Provides centralized rate limiting for critical endpoints
"""

import logging
import time
from functools import wraps
from typing import Optional

from flask import current_app, jsonify, request

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

def connect_rate_limit(rate_limit: int = 60, rate_limit_burst: int = 10):
    """
    Enhanced rate limiting decorator for connect endpoints with progressive delays
    Uses Redis for distributed rate limiting
    Supports both sync and async functions

    Args:
        rate_limit: Maximum requests per minute
        rate_limit_burst: Maximum requests in first 10 seconds
    """
    import inspect
    import asyncio

    def decorator(func):
        is_async = inspect.iscoroutinefunction(func)
        
        def check_rate_limit():
            """Blocking rate limit check"""
            from ..services.connect import ResponseBuilder, SecurityChecker
            from ..utils.redis_client import get_redis_client

            security_checker = SecurityChecker()
            response_builder = ResponseBuilder()

            # Use persistent Redis instance for rate limiting (must not lose data)
            redis_client = get_redis_client()  # Already uses persistent instance by default

            ip = request.remote_addr
            req_json = request.get_json(silent=True) or {}
            user_key = req_json.get("user_key") or ""

            minute_key = f"rl_min:{user_key}:{ip}"
            burst_key = f"rl_burst:{user_key}:{ip}"
            progressive_key = f"rl_prog:{user_key}:{ip}"

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

            if minute_count > 1:
                progressive_count = redis_client.incr(progressive_key)
                if progressive_count == 1:
                    redis_client.expire(progressive_key, 300)

                delay = min(2 ** (progressive_count - 1), 16)
                time.sleep(delay)

            if minute_count > rate_limit:
                security_checker.log_suspicious_activity(ip, "RATE_LIMIT", user_key)
                error_response = response_builder.build_error_response("Rate limit exceeded")
                encrypted_response = response_builder.encrypt_response(error_response, True)
                return encrypted_response, 429

            return None

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

                    return func(*args, **kwargs)

            return sync_wrapper

    return decorator
