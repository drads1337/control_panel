"""
Service Injection Middleware
Provides service injection helpers for routes

This module provides utilities to inject services into Flask's g object,
making it easier to migrate from get_service() calls to DI pattern.

Usage:
    from flask import g
    from ..middleware.service_injection import get_service_from_g, inject_specific_services
    
    # Option 1: Use helper function
    @app.route('/example')
    def example_route():
        rbac_service = get_service_from_g('rbac_service')
        # Use service...
    
    # Option 2: Use decorator for explicit injection
    @app.route('/example')
    @inject_specific_services('rbac_service', 'cache_service')
    def example_route():
        rbac_service = g.rbac_service
        cache_service = g.cache_service
        # Use services...
"""

import logging
from flask import g

logger = logging.getLogger(__name__)

def get_service_from_g(service_name: str):
    """
    Get service from g object with lazy loading and caching.
    
    This is a helper function that can replace get_service() calls in routes.
    Services are cached in g object to avoid repeated lookups.
    
    Args:
        service_name: Name of the service to get
        
    Returns:
        Service instance or None if service not found
        
    Usage:
        rbac_service = get_service_from_g('rbac_service')
        if rbac_service:
            rbac_service.check_permission(...)
    """
    cache_key = f'_{service_name}_instance'
    if not hasattr(g, cache_key):
        try:
            from ..utils.service_helpers import get_service
            setattr(g, cache_key, get_service(service_name))
        except Exception as e:
            logger.warning(f"Failed to get service {service_name}: {e}")
            setattr(g, cache_key, None)
    return getattr(g, cache_key)

def inject_specific_services(*service_names):
    """
    Inject specific services into Flask's g object.
    
    Usage:
        @app.route('/example')
        @inject_specific_services('rbac_service', 'cache_service')
        def example_route():
            rbac_service = g.rbac_service
            cache_service = g.cache_service
    
    Args:
        *service_names: Names of services to inject
    """
    def decorator(f):
        from functools import wraps
        
        @wraps(f)
        def decorated_function(*args, **kwargs):

            for service_name in service_names:
                if not hasattr(g, service_name):
                    try:
                        from ..utils.service_helpers import get_service
                        setattr(g, service_name, get_service(service_name))
                    except Exception as e:
                        logger.warning(f"Failed to inject service {service_name}: {e}")
                        setattr(g, service_name, None)
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator