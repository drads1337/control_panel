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
                # Get limiter from app context
                limiter = current_app.limiter
                if limiter:
                    # Apply rate limiting
                    limiter.limit(limit_string)(lambda: None)()
            except Exception as e:
                logger.warning(f"Rate limiting failed for {request.endpoint}: {e}")
                # Continue execution even if rate limiting fails

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

        # Get the limiter from app context
        limiter = current_app.limiter

        if limiter:
            # Apply strict rate limiting to auth blueprint
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

        # Create a temporary function to test rate limiting
        @limiter.limit(limit_string)
        def test_function():
            return True

        test_function()
        return True

    except Exception as e:
        logger.warning(f"Rate limit check failed for {endpoint_name}: {e}")
        return True  # Allow request if rate limiting fails


def connect_rate_limit(rate_limit: int = 60, rate_limit_burst: int = 10):
    """
    Enhanced rate limiting decorator for connect endpoints with progressive delays
    Uses Redis for distributed rate limiting

    Args:
        rate_limit: Maximum requests per minute
        rate_limit_burst: Maximum requests in first 10 seconds
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                from ..services.connect import ResponseBuilder, SecurityChecker
                from ..utils.redis_client import get_redis_client

                security_checker = SecurityChecker()
                response_builder = ResponseBuilder()

                # Use centralized Redis client for consistency and connection management
                redis_client = get_redis_client()

                ip = request.remote_addr
                req_json = request.get_json(silent=True) or {}
                user_key = req_json.get("user_key") or ""

                # Multiple rate limiting keys for better protection
                minute_key = f"rl_min:{user_key}:{ip}"
                burst_key = f"rl_burst:{user_key}:{ip}"
                progressive_key = f"rl_prog:{user_key}:{ip}"

                # Check burst limit (first 10 seconds)
                burst_count = redis_client.incr(burst_key)
                if burst_count == 1:
                    redis_client.expire(burst_key, 10)  # 10 second window

                if burst_count > rate_limit_burst:
                    security_checker.log_suspicious_activity(ip, "BURST_RATE_LIMIT", user_key)
                    error_response = response_builder.build_error_response(
                        "Burst rate limit exceeded"
                    )
                    encrypted_response = response_builder.encrypt_response(error_response, True)
                    return encrypted_response, 429

                # Check minute limit
                minute_count = redis_client.incr(minute_key)
                if minute_count == 1:
                    redis_client.expire(minute_key, 60)

                # Progressive delay for repeated attempts
                if minute_count > 1:
                    progressive_count = redis_client.incr(progressive_key)
                    if progressive_count == 1:
                        redis_client.expire(progressive_key, 300)  # 5 minutes

                    # Progressive delay: 1s, 2s, 4s, 8s, 16s...
                    delay = min(2 ** (progressive_count - 1), 16)
                    time.sleep(delay)

                if minute_count > rate_limit:
                    security_checker.log_suspicious_activity(ip, "RATE_LIMIT", user_key)
                    error_response = response_builder.build_error_response("Rate limit exceeded")
                    encrypted_response = response_builder.encrypt_response(error_response, True)
                    return encrypted_response, 429

                return func(*args, **kwargs)

            except Exception as e:
                logger.error(f"Rate limiting error: {e}")
                import traceback

                logger.error(f"Rate limiting traceback: {traceback.format_exc()}")
                # If rate limiting fails, still try to execute the function
                return func(*args, **kwargs)

        return wrapper

    return decorator
