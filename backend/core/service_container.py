"""
Simple Dependency Injection Container for services.

This container provides a centralized way to manage service instances,
making it easier to test and mock dependencies.
"""

from typing import Any, Callable, Dict, Optional
from flask import current_app


class ServiceContainer:
    """
    Simple dependency injection container.
    
    Services are registered with factory functions, allowing for
    easy mocking in tests and better dependency management.
    """
    
    def __init__(self):
        self._services: Dict[str, Callable[[], Any]] = {}
        self._instances: Dict[str, Any] = {}
        self._singleton: Dict[str, bool] = {}
    
    def register(
        self, 
        name: str, 
        factory: Callable[[], Any], 
        singleton: bool = True
    ):
        """
        Register a service factory.
        
        Args:
            name: Service name (e.g., 'user_crud_service')
            factory: Factory function that creates the service instance
            singleton: If True, service instance is cached (default: True)
        """
        self._services[name] = factory
        self._singleton[name] = singleton
    
    def get(self, name: str) -> Any:
        """
        Get a service instance.
        
        Args:
            name: Service name
            
        Returns:
            Service instance
            
        Raises:
            ValueError: If service is not registered
        """
        if name not in self._services:
            raise ValueError(f"Service '{name}' is not registered")
        
        # Return cached instance for singletons
        if self._singleton[name] and name in self._instances:
            return self._instances[name]
        
        # Create new instance
        instance = self._services[name]()
        
        # Cache if singleton
        if self._singleton[name]:
            self._instances[name] = instance
        
        return instance
    
    def register_instance(self, name: str, instance: Any):
        """
        Register a pre-created instance (useful for testing).
        
        Args:
            name: Service name
            instance: Service instance
        """
        self._instances[name] = instance
        self._singleton[name] = True
    
    def clear(self):
        """Clear all cached instances (useful for testing)."""
        self._instances.clear()


# Global container instance
_service_container: Optional[ServiceContainer] = None


def get_service_container() -> ServiceContainer:
    """
    Get the global service container.
    
    Returns:
        ServiceContainer instance
    """
    global _service_container
    if _service_container is None:
        _service_container = ServiceContainer()
    return _service_container


def init_services(app):
    """
    Initialize services in the Flask application.
    
    This function should be called during app initialization.
    
    Args:
        app: Flask application instance
    """
    container = get_service_container()
    
    # Register user services
    from ..services.users.user_crud_service import UserCRUDService
    from ..services.users.user_role_service import UserRoleService
    from ..services.users.user_permission_service import UserPermissionService
    from ..services.users.user_statistics_service import UserStatisticsService
    from ..services.users.user_invite_service import UserInviteService
    from ..services.users.user_profile_service import UserProfileService
    
    container.register('user_crud_service', lambda: UserCRUDService())
    container.register('user_role_service', lambda: UserRoleService())
    container.register('user_permission_service', lambda: UserPermissionService())
    container.register('user_statistics_service', lambda: UserStatisticsService())
    container.register('user_invite_service', lambda: UserInviteService())
    container.register('user_profile_service', lambda: UserProfileService())
    
    # Register RBAC service
    from ..services.rbac.rbac_service import RBACService
    container.register('rbac_service', lambda: RBACService())
    
    # Register activity service
    from ..services.activity.activity_service import ActivityService
    container.register('activity_service', lambda: ActivityService())
    
    # Register auth service
    from ..services.auth.auth_service import AuthService
    container.register('auth_service', lambda: AuthService())
    
    # Register security service
    from ..services.security.security_service import SecurityService
    container.register('security_service', lambda: SecurityService())
    
    # Store container in app for access via current_app
    app.service_container = container

