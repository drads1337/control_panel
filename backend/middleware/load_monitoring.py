"""
Load Monitoring Middleware
REPLACED: Custom load_monitor with prometheus-flask-exporter

This middleware is now a thin wrapper around prometheus-flask-exporter.
The actual metrics collection is handled automatically by PrometheusMetrics.

This file is kept for backward compatibility with existing decorator usage.
"""

import inspect
import logging
from functools import wraps

from flask import current_app, request

logger = logging.getLogger(__name__)


def monitor_load(endpoint_name: str):
    """
    Decorator to monitor load on an endpoint.
    
    REPLACED: Now uses prometheus-flask-exporter instead of custom load_monitor.
    Metrics are automatically collected by PrometheusMetrics middleware.
    
    This decorator is kept for backward compatibility but does minimal work
    since prometheus-flask-exporter handles all metrics collection automatically.
    
    Args:
        endpoint_name: Name of the endpoint (e.g., 'connect', 'heartbeat')
    """
    def decorator(func):
        is_async = inspect.iscoroutinefunction(func)
        
        if is_async:
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                # Prometheus metrics are collected automatically by PrometheusMetrics
                # No need for manual recording
                try:
                    response = await func(*args, **kwargs)
                    return response
                except Exception as e:
                    logger.error(f"Error in {endpoint_name} endpoint: {e}")
                    raise
            
            return async_wrapper
        else:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                # Prometheus metrics are collected automatically by PrometheusMetrics
                # No need for manual recording
                try:
                    response = func(*args, **kwargs)
                    return response
                except Exception as e:
                    logger.error(f"Error in {endpoint_name} endpoint: {e}")
                    raise
            
            return sync_wrapper
    return decorator

