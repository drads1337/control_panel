"""
Helper functions for routes to access services through DI container.

This module provides convenient functions for routes to access services
from the dependency injection container, making routes cleaner and more testable.
"""

from flask import current_app, g
from typing import Any, Dict, Optional


def get_service_from_container(service_name: str) -> Any:
    """
    Get a service from the DI container (optimized for routes).
    
    This function uses Flask's g object to cache services per request,
    reducing repeated lookups in the same request.
    
    Usage in routes:
        from ..utils.route_helpers import get_service_from_container
        
        @route_bp.route("/endpoint")
        def my_endpoint():
            rbac_service = get_service_from_container('rbac_service')
            # Use service...
    
    Args:
        service_name: Name of the service to retrieve
        
    Returns:
        Service instance
        
    Raises:
        RuntimeError: If service container is not initialized
        ValueError: If service is not registered
    """
    # Cache services in Flask's g object per request
    if not hasattr(g, '_route_services'):
        g._route_services = {}
    
    # Return cached service if available
    if service_name in g._route_services:
        return g._route_services[service_name]
    
    # Get service from container
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. "
            "Make sure init_services() was called during app initialization."
        )
    
    service = current_app.service_container.get(service_name)
    
    # Cache for this request
    g._route_services[service_name] = service
    
    return service


# Convenience functions for commonly used services in routes
def get_rbac_service() -> Any:
    """Get RBACService instance (cached per request)."""
    return get_service_from_container('rbac_service')


def get_activity_service() -> Any:
    """Get ActivityService instance (cached per request)."""
    return get_service_from_container('activity_service')


def get_file_service() -> Any:
    """Get FileService instance (cached per request)."""
    return get_service_from_container('file_service')


def get_product_service() -> Any:
    """Get ProductService instance (cached per request)."""
    return get_service_from_container('product_service')


def get_task_service() -> Any:
    """Get TaskService instance (cached per request)."""
    return get_service_from_container('task_service')


def get_cache_service() -> Any:
    """Get CacheService instance (cached per request)."""
    return get_service_from_container('cache_service')


def get_project_service() -> Any:
    """Get ProjectService instance (cached per request)."""
    return get_service_from_container('project_service')


def get_webhook_service() -> Any:
    """Get WebhookService instance (cached per request)."""
    return get_service_from_container('webhook_service')


def get_auth_service() -> Any:
    """Get AuthService instance (cached per request)."""
    return get_service_from_container('auth_service')

