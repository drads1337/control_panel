"""
Error handlers module
Centralizes all error handling logic for the application
"""

import logging

from flask import Flask, jsonify, request
from flask_jwt_extended import JWTManager
from flask_jwt_extended.exceptions import CSRFError
from ..config.config import Config

try:
    from flask_limiter.errors import RateLimitExceeded
except ImportError:
    RateLimitExceeded = None

try:
    from ..utils.service_exceptions import ServiceError
except ImportError:
    ServiceError = None

def register_error_handlers(app: Flask) -> None:
    """
    Register all error handlers for the application

    Args:
        app: Flask application instance
    """

    @app.errorhandler(500)
    def internal_error(error):
        """Handle internal server errors"""
        import traceback
        from ..utils.data_masking import mask_string

        error_details = traceback.format_exc()

        safe_error_details = mask_string(error_details)
        logger = logging.getLogger(__name__)
        logger.error(f"=== INTERNAL SERVER ERROR ===\n{safe_error_details}")

        error_response = {"error": "Internal server error", "type": "internal_error"}

        # SECURITY: Never expose tracebacks in production
        # Only show details in development mode (not production)
        from ..config.config import IS_PRODUCTION
        is_safe_to_show_details = not IS_PRODUCTION and Config.FLASK_ENV != "production"
        
        if is_safe_to_show_details:
            error_response["traceback"] = error_details.split("\n")
            error_response["details"] = str(error)
            error_response["message"] = f"{type(error).__name__}: {str(error)}"
        else:
            # Production mode: never expose tracebacks or error details
            # Even if debug mode is accidentally enabled, we don't expose internals
            error_response = {
                "error": "Internal Server Error",
                "message": "An unexpected error occurred. Support team has been notified.",
            }

        return jsonify(error_response), 500

    @app.errorhandler(429)
    def rate_limit_error(error):
        """Handle rate limit exceeded errors (429 Too Many Requests)"""

        error_message = str(error) if error else "Too many requests"

        message = "Rate limit exceeded. Please try again later."
        if "per" in error_message:

            try:
                limit_info = error_message.split(": ")[-1] if ": " in error_message else error_message
                message = f"Rate limit exceeded ({limit_info}). Please try again later."
            except Exception:
                pass

        return (
            jsonify(
                {
                    "error": "Too many requests",
                    "type": "rate_limit_exceeded",
                    "message": message,
                }
            ),
            429,
        )

    if RateLimitExceeded:
        @app.errorhandler(RateLimitExceeded)
        def rate_limit_exceeded_handler(error):
            """Handle Flask-Limiter RateLimitExceeded exceptions"""

            error_message = str(error) if error else "Too many requests"

            message = "Rate limit exceeded. Please try again later."
            limit_info = "unknown"
            if "per" in error_message:

                try:
                    limit_info = error_message.split(": ")[-1] if ": " in error_message else error_message
                    message = f"Rate limit exceeded ({limit_info}). Please try again later."
                except Exception:
                    pass

            logger = logging.getLogger(__name__)
            logger.debug(
                f"Rate limit exceeded - Method: {request.method}, Path: {request.path}, "
                f"IP: {request.remote_addr}, Limit: {limit_info}"
            )

            return (
                jsonify(
                    {
                        "error": "Too many requests",
                        "type": "rate_limit_exceeded",
                        "message": message,
                    }
                ),
                429,
            )

    # Register ServiceError handler before generic Exception handler
    if ServiceError:
        @app.errorhandler(ServiceError)
        def handle_service_error(e: ServiceError):
            """
            Handle ServiceError and its subclasses (ValidationError, NotFoundError, etc.)
            This provides unified error handling for the service layer.
            """
            logger = logging.getLogger(__name__)
            
            # Special handling for AuthenticationError - log suspicious activity
            if hasattr(e, '__class__') and e.__class__.__name__ == 'AuthenticationError':
                try:
                    from flask import request
                    ip = request.remote_addr if request else "unknown"
                    # Log suspicious activity for authentication failures
                    logger.warning(f"Suspicious activity from {ip}: LOGIN_FAIL - AuthenticationError: {e.message}")
                except Exception:
                    pass  # Don't fail if logging fails
            
            # Log the error with context if available
            log_message = f"ServiceError: {type(e).__name__}: {e.message}"
            if e.context:
                context_str = " ".join(f"{k}={v}" for k, v in e.context.items())
                log_message = f"{log_message} {context_str}"
            
            # Use appropriate log level based on status code
            if e.status_code >= 500:
                logger.error(log_message, exc_info=True)
            elif e.status_code >= 400:
                logger.warning(log_message)
            else:
                logger.info(log_message)
            
            # Build error response
            error_response = {
                "error": e.message,
                "type": type(e).__name__.lower().replace("error", ""),
            }
            
            # Add field information for ValidationError
            if hasattr(e, "field") and e.field:
                error_response["field"] = e.field
            
            # Add resource information for NotFoundError
            if hasattr(e, "resource_type") and e.resource_type:
                error_response["resource_type"] = e.resource_type
                if hasattr(e, "resource_id") and e.resource_id:
                    error_response["resource_id"] = e.resource_id
            
            # Add error_code for SecurityError
            if hasattr(e, "error_code") and e.error_code:
                error_response["error_code"] = e.error_code
            
            # In development, include more details (but never in production)
            from ..config.config import IS_PRODUCTION
            is_safe_to_show_details = not IS_PRODUCTION and Config.FLASK_ENV != "production"
            
            if is_safe_to_show_details:
                error_response["exception_type"] = type(e).__name__
                if e.context:
                    error_response["context"] = e.context
            
            return jsonify(error_response), e.status_code

    @app.errorhandler(Exception)
    def handle_unhandled_exception(e):
        """Handle all unhandled exceptions"""
        
        # ServiceError should be handled by its specific handler above
        # Flask will route ServiceError to the registered handler automatically

        if RateLimitExceeded and isinstance(e, RateLimitExceeded):

            error_message = str(e) if e else "Too many requests"
            message = "Rate limit exceeded. Please try again later."
            if "per" in error_message:
                try:
                    limit_info = error_message.split(": ")[-1] if ": " in error_message else error_message
                    message = f"Rate limit exceeded ({limit_info}). Please try again later."
                except Exception:
                    pass
            return (
                jsonify(
                    {
                        "error": "Too many requests",
                        "type": "rate_limit_exceeded",
                        "message": message,
                    }
                ),
                429,
            )

        import traceback
        from ..utils.data_masking import mask_string

        error_details = traceback.format_exc()

        safe_error_details = mask_string(error_details)
        logger = logging.getLogger(__name__)
        logger.error(f"=== UNHANDLED EXCEPTION ===\n{safe_error_details}")

        error_response = {"error": "Internal server error", "type": "unhandled_exception"}

        # SECURITY: Never expose tracebacks in production
        # Only show details in development mode (not production)
        from ..config.config import IS_PRODUCTION
        is_safe_to_show_details = not IS_PRODUCTION and Config.FLASK_ENV != "production"
        
        if is_safe_to_show_details:
            error_response["traceback"] = error_details.split("\n")
            error_response["details"] = str(e)
            error_response["message"] = f"{type(e).__name__}: {str(e)}"
        else:
            # Production mode: never expose tracebacks or error details
            # Even if debug mode is accidentally enabled, we don't expose internals
            error_response = {
                "error": "Internal Server Error",
                "message": "An unexpected error occurred. Support team has been notified.",
            }

        return jsonify(error_response), 500

    @app.errorhandler(404)
    def not_found_error(error):
        """Handle not found errors"""
        return (
            jsonify(
                {
                    "error": "Resource not found",
                    "type": "not_found",
                    "message": "The requested resource was not found",
                }
            ),
            404,
        )

    @app.errorhandler(405)
    def method_not_allowed_error(error):
        """Handle method not allowed errors"""
        return (
            jsonify(
                {
                    "error": "Method not allowed",
                    "type": "method_not_allowed",
                    "message": "The requested HTTP method is not allowed for this resource",
                }
            ),
            405,
        )

def register_jwt_error_handlers(app: Flask) -> None:
    """
    Register JWT-specific error handlers

    Args:
        app: Flask application instance
    """
    jwt_manager = JWTManager(app)

    @jwt_manager.unauthorized_loader
    def unauthorized_callback(callback):
        """Handle unauthorized JWT requests"""
        logger = logging.getLogger(__name__)
        cookie_names = list(request.cookies.keys()) if request.cookies else []
        jwt_cookie_name = app.config.get("JWT_ACCESS_COOKIE_NAME", "access_token_cookie")
        has_jwt_cookie = jwt_cookie_name in request.cookies if request.cookies else False
        logger.error(
            f'🔒 JWT UNAUTHORIZED - Method: {request.method}, Path: {request.path}, Origin: {request.headers.get("Origin")}, Cookies: {cookie_names}, Has JWT Cookie ({jwt_cookie_name}): {has_jwt_cookie}, Callback: {callback}'
        )
        return jsonify({"error": "Authentication required", "msg": "Missing or invalid token"}), 401

    @jwt_manager.invalid_token_loader
    def invalid_token_callback(callback):
        """Handle invalid JWT tokens"""
        logger = logging.getLogger(__name__)
        cookie_names = list(request.cookies.keys()) if request.cookies else []
        jwt_cookie_name = app.config.get("JWT_ACCESS_COOKIE_NAME", "access_token_cookie")
        has_jwt_cookie = jwt_cookie_name in request.cookies if request.cookies else False
        logger.error(
            f'🔒 JWT INVALID TOKEN - Method: {request.method}, Path: {request.path}, Origin: {request.headers.get("Origin")}, Cookies: {cookie_names}, Has JWT Cookie ({jwt_cookie_name}): {has_jwt_cookie}, Callback: {callback}'
        )
        return jsonify({"error": "Authentication required", "msg": "Invalid token"}), 401

    @jwt_manager.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        """Handle expired JWT tokens"""
        logger = logging.getLogger(__name__)
        logger.error(
            f"🔒 JWT EXPIRED - Method: {request.method}, Path: {request.path}, Payload: {jwt_payload}"
        )
        return jsonify({"error": "Authentication required", "msg": "Token expired"}), 401

    @app.errorhandler(CSRFError)
    def csrf_error_callback(error):
        """Handle CSRF errors for JWT cookie-based authentication"""
        logger = logging.getLogger(__name__)
        reason = str(error) if error else "CSRF token validation failed"
        logger.warning(
            f'🔒 CSRF ERROR - Method: {request.method}, Path: {request.path}, Origin: {request.headers.get("Origin")}, Reason: {reason}'
        )
        return (
            jsonify(
                {
                    "error": "CSRF_ERROR",
                    "message": "CSRF token missing or invalid",
                    "msg": reason,
                }
            ),
            403,
        )
