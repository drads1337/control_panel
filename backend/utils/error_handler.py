"""
Error Handler Utility
Centralized error handling logic following DRY principle

This module provides utilities for handling exceptions in a more specific way,
avoiding overly broad `except Exception` that masks logical errors.

Usage:
    from ..utils.error_handler import handle_service_error, is_logical_error
    
    try:
        # logic
    except ValueError as e:
        return handle_service_error(e, "Invalid input", 400)
    except (redis.ConnectionError, redis.TimeoutError) as e:
        return handle_service_error(e, "Service temporarily unavailable", 503)
    except Exception as e:
        if is_logical_error(e):
            # Log logical errors with full traceback in development
            logger.error(f"Logical error: {e}", exc_info=True)
            return handle_service_error(e, "Invalid request", 400)
        else:
            # System errors - mask details in production
            logger.error(f"System error: {e}", exc_info=True)
            return handle_service_error(e, "Internal server error", 500)
"""

import logging
import traceback
from typing import Optional, Tuple, Union

logger = logging.getLogger(__name__)



LOGICAL_ERRORS = (
    ValueError,
    KeyError,
    AttributeError,
    TypeError,
    IndexError,
    AssertionError,
    KeyError,
)



SYSTEM_ERRORS = (
    ConnectionError,
    TimeoutError,
    OSError,
    IOError,
)


try:
    from sqlalchemy.exc import SQLAlchemyError, OperationalError, IntegrityError
    DATABASE_ERRORS = (SQLAlchemyError, OperationalError, IntegrityError)
except ImportError:
    DATABASE_ERRORS = ()


try:
    import redis
    REDIS_ERRORS = (
        redis.ConnectionError,
        redis.TimeoutError,
        redis.RedisError,
    )
except ImportError:
    REDIS_ERRORS = ()


def is_logical_error(exception: Exception) -> bool:
    """
    Check if an exception is a logical error (programming mistake or invalid input)
    vs a system error (infrastructure issue)
    
    Args:
        exception: Exception to check
        
    Returns:
        True if it's a logical error, False if it's a system error
    """
    return isinstance(exception, LOGICAL_ERRORS)


def is_system_error(exception: Exception) -> bool:
    """
    Check if an exception is a system/infrastructure error
    
    Args:
        exception: Exception to check
        
    Returns:
        True if it's a system error
    """
    return isinstance(exception, (SYSTEM_ERRORS + DATABASE_ERRORS + REDIS_ERRORS))


def get_error_category(exception: Exception) -> str:
    """
    Get category of error for logging purposes
    
    Args:
        exception: Exception to categorize
        
    Returns:
        Category string: 'logical', 'system', 'database', 'redis', or 'unknown'
    """
    if is_logical_error(exception):
        return "logical"
    elif isinstance(exception, DATABASE_ERRORS):
        return "database"
    elif isinstance(exception, REDIS_ERRORS):
        return "redis"
    elif is_system_error(exception):
        return "system"
    else:
        return "unknown"


def handle_service_error(
    exception: Exception,
    user_message: str,
    status_code: int = 500,
    log_level: str = "error",
    include_traceback: Optional[bool] = None,
    context: Optional[dict] = None,
) -> Tuple[dict, int]:
    """
    Handle service errors in a consistent way
    
    Args:
        exception: The exception that occurred
        user_message: User-friendly error message
        status_code: HTTP status code to return
        log_level: Logging level ('error', 'warning', 'critical')
        include_traceback: Whether to include traceback in logs (auto-determined if None)
        context: Additional context for logging (e.g., {'ip': '1.2.3.4', 'user_key': 'xxx'})
        
    Returns:
        Tuple of (error_response_dict, status_code)
    """
    error_category = get_error_category(exception)
    

    if include_traceback is None:


        include_traceback = is_logical_error(exception)
    

    log_message = f"{error_category.upper()}_ERROR: {type(exception).__name__}: {str(exception)}"
    if context:
        context_str = " ".join(f"{k}={v}" for k, v in context.items())
        log_message = f"{log_message} {context_str}"
    

    log_func = getattr(logger, log_level, logger.error)
    if include_traceback:
        log_func(log_message, exc_info=True)
    else:
        log_func(log_message)
    

    error_response = {
        "error": user_message,
        "type": error_category,
    }
    

    from ..config.config import Config
    if Config.FLASK_ENV == "development" and is_logical_error(exception):
        error_response["exception_type"] = type(exception).__name__
        error_response["exception_message"] = str(exception)
    
    return error_response, status_code


def safe_execute(
    func,
    default_error_message: str = "Internal server error",
    default_status_code: int = 500,
    context: Optional[dict] = None,
    **kwargs
) -> Tuple[Optional[any], Optional[dict], int]:
    """
    Safely execute a function with proper error handling
    
    Args:
        func: Function to execute
        default_error_message: Default error message if exception occurs
        default_status_code: Default status code if exception occurs
        context: Additional context for logging
        **kwargs: Arguments to pass to func
        
    Returns:
        Tuple of (result, error_response, status_code)
        - If successful: (result, None, 200)
        - If error: (None, error_response, status_code)
    """
    try:
        result = func(**kwargs)
        return result, None, 200
    except LOGICAL_ERRORS as e:
        error_response, status_code = handle_service_error(
            e,
            "Invalid request",
            400,
            context=context,
        )
        return None, error_response, status_code
    except (SYSTEM_ERRORS + DATABASE_ERRORS + REDIS_ERRORS) as e:
        error_response, status_code = handle_service_error(
            e,
            default_error_message,
            default_status_code,
            context=context,
        )
        return None, error_response, status_code
    except Exception as e:

        error_response, status_code = handle_service_error(
            e,
            default_error_message,
            default_status_code,
            context=context,
            include_traceback=True,
        )
        return None, error_response, status_code

