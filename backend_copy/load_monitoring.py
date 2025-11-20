"""
Load Monitoring Middleware
Automatically tracks request metrics for connect and heartbeat endpoints.
"""

import logging
import time
from functools import wraps

from flask import request, g

from ..services.monitoring.load_monitor import load_monitor

logger = logging.getLogger(__name__)


def monitor_load(endpoint_name: str):
    """
    Decorator to monitor load on an endpoint.
    
    Args:
        endpoint_name: Name of the endpoint (e.g., 'connect', 'heartbeat')
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            status_code = 200
            ip = request.remote_addr
            
            try:
                # Execute the endpoint function
                response = func(*args, **kwargs)
                
                # Extract status code from response
                # Flask responses can be: (data, status_code), (data, status_code, headers), or just data
                if isinstance(response, tuple):
                    if len(response) >= 2:
                        status_code = response[1]
                        # Handle case where status_code might be a dict (headers)
                        if isinstance(status_code, dict):
                            status_code = 200
                    else:
                        status_code = 200
                else:
                    status_code = 200
                
                return response
                
            except Exception as e:
                status_code = 500
                logger.error(f"Error in {endpoint_name} endpoint: {e}")
                raise
                
            finally:
                # Calculate response time
                response_time_ms = (time.time() - start_time) * 1000
                
                # Record metric
                try:
                    load_monitor.record_request(
                        endpoint=endpoint_name,
                        response_time_ms=response_time_ms,
                        status_code=status_code,
                        ip=ip,
                    )
                except Exception as e:
                    logger.error(f"Failed to record load metric: {e}")
        
        return wrapper
    return decorator

