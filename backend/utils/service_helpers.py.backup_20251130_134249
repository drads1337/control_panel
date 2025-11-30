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
        from ...utils.service_helpers import get_service
        
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
def get_user_crud_service():
    """Get UserCRUDService instance."""
    return get_service('user_crud_service')


def get_user_role_service():
    """Get UserRoleService instance."""
    return get_service('user_role_service')


def get_user_permission_service():
    """Get UserPermissionService instance."""
    return get_service('user_permission_service')


def get_user_statistics_service():
    """Get UserStatisticsService instance."""
    return get_service('user_statistics_service')


def get_user_invite_service():
    """Get UserInviteService instance."""
    return get_service('user_invite_service')


def get_user_profile_service():
    """Get UserProfileService instance."""
    return get_service('user_profile_service')


def get_rbac_service():
    """Get RBACService instance."""
    return get_service('rbac_service')


def get_activity_service():
    """Get ActivityService instance."""
    return get_service('activity_service')

