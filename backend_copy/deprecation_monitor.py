"""
Deprecation Monitor
Tracks usage of deprecated functions and logs warnings for monitoring.

This module provides utilities to monitor and log usage of deprecated functions,
allowing teams to track migration progress and identify areas that need updates.
"""

import logging
import warnings
from functools import wraps
from typing import Callable, Optional, Dict
from collections import defaultdict
from datetime import datetime

logger = logging.getLogger(__name__)

# Global registry for deprecated function usage
_deprecation_usage: Dict[str, int] = defaultdict(int)
_deprecation_stack_traces: Dict[str, list] = defaultdict(list)

def track_deprecation(func_name: str, stacklevel: int = 2) -> None:
    """
    Track usage of a deprecated function and log it.
    
    Args:
        func_name: Name of the deprecated function
        stacklevel: Stack level for warning (default: 2)
    """
    import traceback
    
    # Increment usage counter
    _deprecation_usage[func_name] += 1
    
    # Get stack trace (limit to 5 frames to avoid excessive logging)
    stack = traceback.extract_stack(limit=5)[:-1]  # Exclude this function
    if len(stack) > 0:
        caller = stack[-1]
        location = f"{caller.filename}:{caller.lineno}"
        
        # Store stack trace (keep only last 10 unique locations per function)
        traces = _deprecation_stack_traces[func_name]
        if location not in traces:
            traces.append(location)
            if len(traces) > 10:
                traces.pop(0)
    
    # Log warning every 100th call to avoid log spam
    usage_count = _deprecation_usage[func_name]
    if usage_count % 100 == 0:
        logger.warning(
            f"Deprecated function '{func_name}' has been called {usage_count} times. "
            f"Last 10 call locations: {', '.join(_deprecation_stack_traces[func_name][-5:])}"
        )

def get_deprecation_report() -> Dict[str, Dict]:
    """
    Get a report of deprecated function usage.
    
    Returns:
        Dictionary with function names as keys and usage stats as values
    """
    return {
        func_name: {
            "total_calls": count,
            "call_locations": list(_deprecation_stack_traces[func_name])
        }
        for func_name, count in _deprecation_usage.items()
    }

def reset_deprecation_stats() -> None:
    """Reset deprecation usage statistics (useful for testing)."""
    _deprecation_usage.clear()
    _deprecation_stack_traces.clear()

def deprecated_monitor(func_name: Optional[str] = None, log_every: int = 100):
    """
    Decorator to monitor usage of deprecated functions.
    
    Args:
        func_name: Name to use for tracking (defaults to function name)
        log_every: Log warning every N calls (default: 100)
    
    Usage:
        @deprecated_monitor()
        def old_function():
            ...
    """
    def decorator(func: Callable) -> Callable:
        name = func_name or f"{func.__module__}.{func.__qualname__}"
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            track_deprecation(name)
            return func(*args, **kwargs)
        
        return wrapper
    return decorator

# Set up custom warning handler to capture DeprecationWarnings
_original_warning_handler = warnings.showwarning

def custom_warning_handler(message, category, filename, lineno, file=None, line=None):
    """Custom warning handler that logs deprecation warnings."""
    if category == DeprecationWarning:
        # Extract function name from warning message if possible
        msg = str(message)
        if "is deprecated" in msg:
            # Try to extract function name
            parts = msg.split("is deprecated")[0].strip()
            func_name = parts.split()[-1] if parts else "unknown"
            track_deprecation(func_name)
        
        # Also log to application logger
        logger.warning(
            f"DeprecationWarning: {message} at {filename}:{lineno}",
            extra={
                "category": category.__name__,
                "filename": filename,
                "lineno": lineno
            }
        )
    
    # Call original handler
    _original_warning_handler(message, category, filename, lineno, file, line)

# Install custom warning handler
warnings.showwarning = custom_warning_handler

