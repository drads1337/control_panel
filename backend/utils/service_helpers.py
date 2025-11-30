"""
Helper functions for accessing services from the DI container.

This module provides convenient functions to access services from the
dependency injection container, making it easier to use services in routes
and other parts of the application.
"""

from flask import current_app
from typing import Any


def get_service(service_name: str) -> Any:
    """
    Get a service from the DI container.
    
    Usage:
        
        user_crud = get_service('user_crud_service')
        user_crud.create_user(...)
    
    Args:
        service_name: Name of the service to retrieve
        
    Returns:
        Service instance
        
    Raises:
        RuntimeError: If service container is not initialized
        ValueError: If service is not registered
    """
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get(service_name)


# Convenience functions for commonly used services
# These functions are kept for backward compatibility
# New code should use get_service() directly or DI through constructors
# These functions use DI directly through current_app.service_container

def get_user_crud_service():
    """Get UserCRUDService instance."""
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get('user_crud_service')


def get_user_role_service():
    """Get UserRoleService instance."""
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get('user_role_service')


def get_user_permission_service():
    """Get UserPermissionService instance."""
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get('user_permission_service')


def get_user_statistics_service():
    """Get UserStatisticsService instance."""
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get('user_statistics_service')


def get_user_invite_service():
    """Get UserInviteService instance."""
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get('user_invite_service')


def get_user_profile_service():
    """Get UserProfileService instance."""
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get('user_profile_service')


def get_rbac_service():
    """Get RBACService instance."""
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get('rbac_service')


def get_activity_service():
    """Get ActivityService instance."""
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get('activity_service')

