"""
Dependency Injection Container for services with lifecycle management.

This container provides a centralized way to manage service instances with
support for different scopes (singleton, request-scoped, transient) and
lifecycle hooks (initialization and cleanup).

Scopes:
- singleton: One instance per application lifetime (default)
- request: One instance per Flask request (stored in Flask's g object)
- transient: New instance on every get() call

Lifecycle:
- Services can implement on_init() and on_cleanup() methods for lifecycle hooks
"""

from enum import Enum
from typing import Any, Callable, Dict, Optional
from flask import current_app, g, has_request_context


class ServiceScope(Enum):
    """Service lifecycle scope"""
    SINGLETON = "singleton"  # One instance per application
    REQUEST = "request"      # One instance per Flask request
    TRANSIENT = "transient"  # New instance on every get()


class ServiceContainer:
    """
    Dependency injection container with scope and lifecycle management.
    
    Services are registered with factory functions and can have different
    scopes (singleton, request-scoped, transient) and lifecycle hooks.
    """
    
    def __init__(self):
        self._services: Dict[str, Callable[[], Any]] = {}
        self._scopes: Dict[str, ServiceScope] = {}
        self._instances: Dict[str, Any] = {}  # Singleton instances
        self._lifecycle_hooks: Dict[str, Dict[str, Optional[Callable]]] = {}
    
    def register(
        self, 
        name: str, 
        factory: Callable[[], Any], 
        scope: ServiceScope = ServiceScope.SINGLETON,
        on_init: Optional[Callable[[Any], None]] = None,
        on_cleanup: Optional[Callable[[Any], None]] = None,
    ):
        """
        Register a service factory.
        
        Args:
            name: Service name (e.g., 'user_crud_service')
            factory: Factory function that creates the service instance
            scope: Service scope (SINGLETON, REQUEST, or TRANSIENT)
            on_init: Optional callback called after instance creation (receives instance)
            on_cleanup: Optional callback called before instance cleanup (receives instance)
        """
        self._services[name] = factory
        self._scopes[name] = scope
        self._lifecycle_hooks[name] = {
            "on_init": on_init,
            "on_cleanup": on_cleanup,
        }
    
    def get(self, name: str) -> Any:
        """
        Get a service instance based on its scope.
        
        Args:
            name: Service name
            
        Returns:
            Service instance
            
        Raises:
            ValueError: If service is not registered
        """
        if name not in self._services:
            raise ValueError(f"Service '{name}' is not registered")
        
        scope = self._scopes[name]
        
        # Handle different scopes
        if scope == ServiceScope.SINGLETON:
            return self._get_singleton(name)
        elif scope == ServiceScope.REQUEST:
            return self._get_request_scoped(name)
        elif scope == ServiceScope.TRANSIENT:
            return self._create_instance(name)
        else:
            raise ValueError(f"Unknown scope: {scope}")
    
    def _get_singleton(self, name: str) -> Any:
        """Get or create singleton instance"""
        if name in self._instances:
            return self._instances[name]
        
        instance = self._create_instance(name)
        self._instances[name] = instance
        return instance
    
    def _get_request_scoped(self, name: str) -> Any:
        """Get or create request-scoped instance"""
        if not has_request_context():
            # Fallback to singleton if no request context (e.g., in tests or background tasks)
            return self._get_singleton(name)
        
        # Use Flask's g object to store request-scoped instances
        if not hasattr(g, '_service_instances'):
            g._service_instances = {}
        
        if name in g._service_instances:
            return g._service_instances[name]
        
        instance = self._create_instance(name)
        g._service_instances[name] = instance
        return instance
    
    def _create_instance(self, name: str) -> Any:
        """Create a new service instance and call lifecycle hooks"""
        factory = self._services[name]
        instance = factory()
        
        # Call on_init hook if provided
        on_init = self._lifecycle_hooks[name]["on_init"]
        if on_init:
            try:
                on_init(instance)
            except Exception as e:
                # Log error but don't fail instance creation
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error in on_init hook for service '{name}': {e}")
        
        return instance
    
    def cleanup_request_instances(self):
        """
        Cleanup request-scoped instances.
        
        This should be called after each request (via Flask teardown handler).
        Calls on_cleanup hooks for request-scoped services.
        """
        if not has_request_context():
            return
        
        if not hasattr(g, '_service_instances'):
            return
        
        # Call cleanup hooks and clear instances
        for name, instance in g._service_instances.items():
            on_cleanup = self._lifecycle_hooks.get(name, {}).get("on_cleanup")
            if on_cleanup:
                try:
                    on_cleanup(instance)
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error in on_cleanup hook for service '{name}': {e}")
        
        g._service_instances.clear()
    
    def register_instance(self, name: str, instance: Any, scope: ServiceScope = ServiceScope.SINGLETON):
        """
        Register a pre-created instance (useful for testing).
        
        Args:
            name: Service name
            instance: Service instance
            scope: Service scope (default: SINGLETON)
        """
        if scope == ServiceScope.SINGLETON:
            self._instances[name] = instance
        elif scope == ServiceScope.REQUEST:
            if not has_request_context():
                # Fallback to singleton if no request context
                self._instances[name] = instance
            else:
                if not hasattr(g, '_service_instances'):
                    g._service_instances = {}
                g._service_instances[name] = instance
        # TRANSIENT scope doesn't make sense for register_instance
        
        self._scopes[name] = scope
    
    def clear(self):
        """
        Clear all cached instances (useful for testing).
        
        Note: This only clears singleton instances. Request-scoped instances
        are managed by Flask's request context.
        """
        self._instances.clear()
    
    def clear_all(self):
        """
        Clear all instances including request-scoped (for testing).
        
        Warning: This should only be used in tests. In production, use
        cleanup_request_instances() which properly handles lifecycle hooks.
        """
        self._instances.clear()
        if has_request_context() and hasattr(g, '_service_instances'):
            g._service_instances.clear()


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
    It registers all services and sets up request cleanup handlers.
    
    Args:
        app: Flask application instance
    """
    container = get_service_container()
    
    # Register user services (singleton scope - stateless services)
    from ..services.users.user_crud_service import UserCRUDService
    from ..services.users.user_role_service import UserRoleService
    from ..services.users.user_permission_service import UserPermissionService
    from ..services.users.user_statistics_service import UserStatisticsService
    from ..services.users.user_invite_service import UserInviteService
    from ..services.users.user_profile_service import UserProfileService
    
    container.register('user_crud_service', lambda: UserCRUDService(), scope=ServiceScope.SINGLETON)
    container.register('user_role_service', lambda: UserRoleService(), scope=ServiceScope.SINGLETON)
    container.register('user_permission_service', lambda: UserPermissionService(), scope=ServiceScope.SINGLETON)
    container.register('user_statistics_service', lambda: UserStatisticsService(), scope=ServiceScope.SINGLETON)
    container.register('user_invite_service', lambda: UserInviteService(), scope=ServiceScope.SINGLETON)
    container.register('user_profile_service', lambda: UserProfileService(), scope=ServiceScope.SINGLETON)
    
    # Register RBAC service (singleton - stateless)
    from ..services.rbac.rbac_service import RBACService
    container.register('rbac_service', lambda: RBACService(), scope=ServiceScope.SINGLETON)
    
    # Register activity service (singleton - stateless)
    from ..services.activity.activity_service import ActivityService
    container.register('activity_service', lambda: ActivityService(), scope=ServiceScope.SINGLETON)
    
    # Register auth service (singleton - stateless)
    from ..services.auth.auth_service import AuthService
    container.register('auth_service', lambda: AuthService(), scope=ServiceScope.SINGLETON)
    
    # Register security service (singleton - stateless)
    from ..services.security.security_service import SecurityService
    container.register('security_service', lambda: SecurityService(), scope=ServiceScope.SINGLETON)
    
    # Register settings services (singleton - stateless)
    from ..services.settings.settings_repository import SettingsRepository
    from ..services.settings.settings_manager import SettingsManager
    from ..services.settings.settings_service import SettingsService
    
    container.register('settings_repository', lambda: SettingsRepository(), scope=ServiceScope.SINGLETON)
    container.register('settings_manager', lambda: SettingsManager(), scope=ServiceScope.SINGLETON)
    container.register('settings_service', lambda: SettingsService(), scope=ServiceScope.SINGLETON)
    
    # Register cache service (singleton - stateless)
    from ..services.cache.cache_service import CacheService
    container.register('cache_service', lambda: CacheService(), scope=ServiceScope.SINGLETON)
    
    # Register session service (singleton - stateless)
    from ..services.sessions.session_service import SessionService
    container.register('session_service', lambda: SessionService(), scope=ServiceScope.SINGLETON)
    
    # Register analytics service (singleton - stateless)
    from ..services.analytics.analytics_service import AnalyticsService
    container.register('analytics_service', lambda: AnalyticsService(), scope=ServiceScope.SINGLETON)
    
    # Setup request cleanup handler
    @app.teardown_request
    def cleanup_services(exception):
        """Cleanup request-scoped service instances after each request"""
        container.cleanup_request_instances()
    
    # Store container in app for access via current_app
    app.service_container = container

