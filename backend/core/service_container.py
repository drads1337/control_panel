"""
Dependency Injection Container for services with lifecycle management.

This container provides a centralized way to manage service instances with
support for different scopes (singleton, request-scoped, transient) and
lifecycle hooks (initialization and cleanup).

API STABILITY:
==============
This API is FROZEN and should not be changed without careful consideration.
Breaking changes to the public API (register, get, register_instance, clear, etc.)
will break existing code throughout the codebase.

If you need to extend functionality, consider:
1. Adding new optional parameters (with defaults) to existing methods
2. Creating new methods rather than modifying existing ones
3. Documenting any changes in CHANGELOG.md

Scopes:
- singleton: One instance per application lifetime (default)
- request: One instance per Flask request (stored in Flask's g object)
- transient: New instance on every get() call

Lifecycle:
- Services can implement on_init() and on_cleanup() methods for lifecycle hooks

USAGE:
======
    from ..core.service_container import get_service_container, ServiceScope
    
    container = get_service_container()
    
    # Register a service
    container.register('my_service', MyService, scope=ServiceScope.SINGLETON)
    
    # Get a service
    my_service = container.get('my_service')
    
    # In routes/services, use get_service() helper:
    from ..utils.service_helpers import get_service
    my_service = get_service('my_service')

MIGRATION NOTES:
================
This is a custom DI container. While there are standard libraries (Dependency Injector, Punq),
this implementation is tailored to our Flask application needs and is now frozen.

For new projects, consider using standard libraries, but for this codebase,
maintain backward compatibility with existing code.
"""

from enum import Enum
from typing import Any, Callable, Dict, Optional, get_type_hints, get_origin, get_args
import inspect
from flask import current_app, g, has_request_context


class ServiceScope(Enum):
    """Service lifecycle scope"""
    SINGLETON = "singleton"
    REQUEST = "request"
    TRANSIENT = "transient"


class ServiceContainer:
    """
    Dependency injection container with scope and lifecycle management.
    
    Services are registered with factory functions and can have different
    scopes (singleton, request-scoped, transient) and lifecycle hooks.
    """
    
    def __init__(self):
        self._services: Dict[str, Callable[[], Any]] = {}
        self._scopes: Dict[str, ServiceScope] = {}
        self._instances: Dict[str, Any] = {}
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

            return self._get_singleton(name)
        

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
        

        if inspect.isclass(factory):
            instance = self._create_with_di(factory, name)
        else:
            instance = factory()
        

        on_init = self._lifecycle_hooks[name]["on_init"]
        if on_init:
            try:
                on_init(instance)
            except Exception as e:

                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error in on_init hook for service '{name}': {e}")
        
        return instance
    
    def _create_with_di(self, service_class: type, service_name: str) -> Any:
        """
        Create service instance with automatic dependency injection.
        
        This method inspects the service class constructor and automatically
        resolves dependencies from the container. Supports recursive dependency
        resolution and handles circular dependencies gracefully.
        
        Args:
            service_class: The service class to instantiate
            service_name: Name of the service (for logging)
            
        Returns:
            Service instance with dependencies injected
        """
        try:

            if not hasattr(self, '_creating_services'):
                self._creating_services = set()
            

            if service_name in self._creating_services:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Circular dependency detected for {service_name}. "
                    f"Attempting to inject non-circular dependencies."
                )

                sig = inspect.signature(service_class.__init__)
                params = {}
                
                for param_name, param in sig.parameters.items():
                    if param_name == 'self':
                        continue
                    

                    if not self._is_service_parameter(param_name):
                        if param.default != inspect.Parameter.empty:
                            params[param_name] = param.default
                        continue
                    

                    service_key = self._map_param_to_service(param_name)
                    

                    if service_key not in self._creating_services and service_key in self._services:
                        try:

                            if service_key in self._instances:
                                params[param_name] = self._instances[service_key]
                            elif param.default != inspect.Parameter.empty:

                                params[param_name] = param.default
                        except Exception:

                            if param.default != inspect.Parameter.empty:
                                params[param_name] = param.default
                    elif param.default != inspect.Parameter.empty:

                        params[param_name] = param.default
                
                return service_class(**params)
            
            self._creating_services.add(service_name)
            
            try:

                sig = inspect.signature(service_class.__init__)
                params = {}
                

                for param_name, param in sig.parameters.items():
                    if param_name == 'self':
                        continue
                    

                    if not self._is_service_parameter(param_name):

                        if param.default != inspect.Parameter.empty:
                            params[param_name] = param.default
                        continue
                    

                    service_key = self._map_param_to_service(param_name)
                    

                    if param.default != inspect.Parameter.empty:

                        if service_key in self._services:
                            try:
                                params[param_name] = self.get(service_key)
                            except (ValueError, KeyError) as e:
                                import logging
                                logger = logging.getLogger(__name__)
                                logger.debug(
                                    f"Could not resolve dependency '{service_key}' for {service_name}, "
                                    f"using default: {e}"
                                )
                                params[param_name] = param.default
                        else:
                            params[param_name] = param.default
                    else:

                        if service_key in self._services:
                            try:
                                params[param_name] = self.get(service_key)
                            except (ValueError, KeyError) as e:
                                import logging
                                logger = logging.getLogger(__name__)
                                logger.debug(
                                    f"Could not resolve required dependency '{service_key}' "
                                    f"for {service_name}: {e}. Service will use lazy loading."
                                )


                
                instance = service_class(**params)
                return instance
            finally:
                self._creating_services.discard(service_name)
                
        except Exception as e:

            import logging
            logger = logging.getLogger(__name__)
            logger.debug(
                f"Auto-DI failed for {service_name}, falling back to no-args constructor: {e}",
                exc_info=True
            )
            if hasattr(self, '_creating_services'):
                self._creating_services.discard(service_name)
            return service_class()
    
    def _is_service_parameter(self, param_name: str) -> bool:
        """
        Check if a parameter name indicates a service dependency.
        
        Args:
            param_name: Parameter name from constructor
            
        Returns:
            True if parameter looks like a service dependency
        """

        non_service_params = {'logger', 'log', 'config', 'settings', 'db', 'session'}
        
        if param_name in non_service_params:
            return False
        

        if param_name.endswith('_service'):
            return True
        

        if param_name.startswith('_') and param_name.endswith('_service'):
            return True
        
        return False
    
    def _map_param_to_service(self, param_name: str) -> str:
        """
        Map constructor parameter name to service name in container.
        
        Examples:
            key_validation_service -> 'key_validation_service'
            _key_validation_service -> 'key_validation_service'
            cache_service -> 'cache_service'
            activity_service -> 'activity_service'
        """

        service_name = param_name.lstrip('_')
        

        if service_name.endswith('_service'):
            return service_name
        

        return f"{service_name}_service"
    
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

                self._instances[name] = instance
            else:
                if not hasattr(g, '_service_instances'):
                    g._service_instances = {}
                g._service_instances[name] = instance

        
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
    

    from ..services.users.user_crud_service import UserCRUDService
    from ..services.users.user_role_service import UserRoleService
    from ..services.users.user_permission_service import UserPermissionService
    from ..services.users.user_statistics_service import UserStatisticsService
    from ..services.users.user_invite_service import UserInviteService
    from ..services.users.user_profile_service import UserProfileService
    

    container.register('user_crud_service', UserCRUDService, scope=ServiceScope.SINGLETON)

    container.register('user_role_service', UserRoleService, scope=ServiceScope.SINGLETON)
    container.register('user_permission_service', lambda: UserPermissionService(), scope=ServiceScope.SINGLETON)

    container.register('user_statistics_service', UserStatisticsService, scope=ServiceScope.SINGLETON)

    container.register('user_invite_service', UserInviteService, scope=ServiceScope.SINGLETON)

    container.register('user_profile_service', UserProfileService, scope=ServiceScope.SINGLETON)
    

    from ..services.users.user_orchestrator import UserOrchestrator

    container.register('user_orchestrator', UserOrchestrator, scope=ServiceScope.SINGLETON)
    

    from ..services.projects.project_relationships_service import ProjectRelationshipsService
    container.register('project_relationships_service', lambda: ProjectRelationshipsService(), scope=ServiceScope.SINGLETON)
    

    from ..services.rbac.rbac_service import RBACService

    container.register('rbac_service', RBACService, scope=ServiceScope.SINGLETON)
    

    from ..services.activity.activity_service import ActivityService

    container.register('activity_service', ActivityService, scope=ServiceScope.SINGLETON)
    

    from ..services.auth.login_service import LoginService
    from ..services.auth.auth_token_service import AuthTokenService
    from ..services.auth.auth_service import AuthService

    container.register('login_service', LoginService, scope=ServiceScope.SINGLETON)
    container.register('auth_token_service', lambda: AuthTokenService(), scope=ServiceScope.SINGLETON)
    container.register('auth_service', AuthService, scope=ServiceScope.SINGLETON)
    

    from ..services.security.security_service import SecurityService
    from ..services.security.security_audit_service import SecurityAuditService
    from ..services.security.security_monitoring_service import SecurityMonitoringService
    from ..services.security.security_rules_service import SecurityRulesService
    from ..services.security.security_rules_init import SecurityRulesInitService

    container.register('security_service', SecurityService, scope=ServiceScope.SINGLETON)

    container.register('security_audit_service', SecurityAuditService, scope=ServiceScope.SINGLETON)

    container.register('security_monitoring_service', SecurityMonitoringService, scope=ServiceScope.SINGLETON)

    container.register('security_rules_service', SecurityRulesService, scope=ServiceScope.SINGLETON)
    container.register('security_rules_init_service', lambda: SecurityRulesInitService(), scope=ServiceScope.SINGLETON)
    


    from ..services.cache.cache_service import CacheService

    container.register('cache_service', CacheService, scope=ServiceScope.SINGLETON)
    


    from ..services.settings.settings_repository import SettingsRepository
    from ..services.settings.settings_manager import SettingsManager
    from ..services.settings.settings_service import SettingsService
    
    container.register('settings_repository', lambda: SettingsRepository(), scope=ServiceScope.SINGLETON)

    container.register('settings_manager', SettingsManager, scope=ServiceScope.SINGLETON)

    container.register('settings_service', SettingsService, scope=ServiceScope.SINGLETON)
    

    from ..services.sessions.session_service import SessionService

    container.register('session_service', SessionService, scope=ServiceScope.SINGLETON)
    

    from ..services.analytics.analytics_service import AnalyticsService
    container.register('analytics_service', lambda: AnalyticsService(), scope=ServiceScope.SINGLETON)
    

    from ..services.analytics.analytics_buffer_service import AnalyticsBufferService
    container.register('analytics_buffer_service', lambda: AnalyticsBufferService(), scope=ServiceScope.SINGLETON)
    

    from ..services.analytics.persistence_layer import PersistenceLayer

    container.register('persistence_layer', PersistenceLayer, scope=ServiceScope.SINGLETON)
    

    from ..services.statistics.cached_statistics_service import CachedStatisticsService

    container.register('cached_statistics_service', CachedStatisticsService, scope=ServiceScope.SINGLETON)
    

    from ..services.products.product_service import ProductService
    from ..services.products.price_calculation_service import PriceCalculationService

    container.register('product_service', ProductService, scope=ServiceScope.SINGLETON)
    container.register('price_calculation_service', lambda: PriceCalculationService(), scope=ServiceScope.SINGLETON)
    

    from ..services.keys.key_crud_service import KeyCRUDService
    from ..services.keys.key_bulk_operations_service import KeyBulkOperationsService
    from ..services.keys.key_validation_service import KeyValidationService
    from ..services.keys.key_status_service import KeyStatusService
    from ..services.keys.key_statistics_service import KeyStatisticsService
    from ..services.keys.key_export_service import KeyExportService
    from ..services.keys.key_generation_service import KeyGenerationService
    from ..services.keys.key_validator import KeyValidator
    


    container.register('key_validation_service', KeyValidationService, scope=ServiceScope.SINGLETON)
    container.register('key_generation_service', lambda: KeyGenerationService(), scope=ServiceScope.SINGLETON)
    



    container.register('key_crud_service', KeyCRUDService, scope=ServiceScope.SINGLETON)
    



    container.register('key_bulk_operations_service', KeyBulkOperationsService, scope=ServiceScope.SINGLETON)
    container.register('key_status_service', lambda: KeyStatusService(), scope=ServiceScope.SINGLETON)
    container.register('key_statistics_service', lambda: KeyStatisticsService(), scope=ServiceScope.SINGLETON)

    container.register('key_export_service', KeyExportService, scope=ServiceScope.SINGLETON)
    container.register('key_validator', KeyValidator, scope=ServiceScope.SINGLETON)
    

    from ..services.files.file_service import FileService
    container.register('file_service', lambda: FileService(), scope=ServiceScope.SINGLETON)
    
    from ..services.library_hash.library_hash_service import LibraryHashService
    container.register('library_hash_service', lambda: LibraryHashService(), scope=ServiceScope.SINGLETON)
    

    from ..services.balance.balance_service import BalanceService

    container.register('balance_service', BalanceService, scope=ServiceScope.SINGLETON)
    

    from ..services.auth.challenge_service import ChallengeService
    container.register('challenge_service', lambda: ChallengeService(), scope=ServiceScope.SINGLETON)
    

    from ..services.connect.connect_service import ConnectService


    container.register('connect_service', ConnectService, scope=ServiceScope.SINGLETON)
    

    from ..services.connect.device_update_buffer import DeviceUpdateBuffer
    container.register('device_update_buffer', lambda: DeviceUpdateBuffer(), scope=ServiceScope.SINGLETON)
    

    from ..services.projects.project_service import ProjectService
    from ..services.projects.project_relationships_service import ProjectRelationshipsService
    from ..services.projects.project_cache_service import ProjectCacheService
    from ..services.projects.project_crud_service import ProjectCRUDService
    from ..services.projects.project_invite_service import ProjectInviteService
    


    container.register('project_crud_service', ProjectCRUDService, scope=ServiceScope.SINGLETON)

    container.register('project_cache_service', ProjectCacheService, scope=ServiceScope.SINGLETON)
    container.register('project_invite_service', lambda: ProjectInviteService(), scope=ServiceScope.SINGLETON)
    

    container.register('project_service', ProjectService, scope=ServiceScope.SINGLETON)

    

    from ..services.servers.server_service import ServerService

    container.register('server_service', ServerService, scope=ServiceScope.SINGLETON)
    

    from ..services.logs.log_cleanup_service import LogCleanupService
    container.register('log_cleanup_service', lambda: LogCleanupService(), scope=ServiceScope.SINGLETON)
    

    from ..services.notifications.notification_service import NotificationService

    container.register('notification_service', NotificationService, scope=ServiceScope.SINGLETON)
    

    from ..services.heartbeat.heartbeat_service import HeartbeatService
    container.register('heartbeat_service', lambda: HeartbeatService(), scope=ServiceScope.SINGLETON)
    

    from ..services.tasks.task_service import TaskService
    container.register('task_service', lambda: TaskService(), scope=ServiceScope.SINGLETON)
    

    from ..services.dynamic_config.dynamic_config_service import DynamicConfigService

    container.register('dynamic_config_service', DynamicConfigService, scope=ServiceScope.SINGLETON)
    

    from ..services.admin.admin_service import AdminService

    container.register('admin_service', AdminService, scope=ServiceScope.SINGLETON)
    

    from ..services.rbac.authorization_audit import AuthorizationAuditService
    from ..services.rbac.abac_service import ABACService
    from ..services.rbac.role_service import RoleService
    from ..services.rbac.permission_service import PermissionService
    from ..services.rbac.policy_engine import PolicyEngine
    container.register('authorization_audit_service', lambda: AuthorizationAuditService(), scope=ServiceScope.SINGLETON)
    container.register('abac_service', lambda: ABACService(), scope=ServiceScope.SINGLETON)

    container.register('role_service', RoleService, scope=ServiceScope.SINGLETON)

    container.register('permission_service', PermissionService, scope=ServiceScope.SINGLETON)

    container.register('policy_engine', PolicyEngine, scope=ServiceScope.SINGLETON)
    

    from ..services.users.two_factor_service import TwoFactorService
    from ..services.users.user_relationships_service import UserRelationshipsService
    from ..services.users.invite_service import InviteService

    container.register('two_factor_service', TwoFactorService, scope=ServiceScope.SINGLETON)
    container.register('user_relationships_service', lambda: UserRelationshipsService(), scope=ServiceScope.SINGLETON)
    container.register('invite_service', lambda: InviteService(), scope=ServiceScope.SINGLETON)
    

    from ..services.auth.password_reset_service import PasswordResetService

    container.register('password_reset_service', PasswordResetService, scope=ServiceScope.SINGLETON)
    from ..services.monitoring.prometheus_metrics_reader import PrometheusMetricsReader
    container.register('prometheus_metrics_reader', lambda: PrometheusMetricsReader(), scope=ServiceScope.SINGLETON)
    from ..services.validation.request_validation_pipeline import RequestValidationPipeline

    container.register('request_validation_pipeline', RequestValidationPipeline, scope=ServiceScope.SINGLETON)
    from ..services.webhooks.webhook_formatting_service import WebhookFormattingService
    from ..services.webhooks.webhook_logging_service import WebhookLoggingService
    from ..services.webhooks.webhook_testing_service import WebhookTestingService
    from ..services.webhooks.webhook_pending_task_service import WebhookPendingTaskService
    from ..services.webhooks.webhook_crypto_service import WebhookCryptoService
    
    container.register('webhook_formatting_service', lambda: WebhookFormattingService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_logging_service', lambda: WebhookLoggingService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_testing_service', lambda: WebhookTestingService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_pending_task_service', lambda: WebhookPendingTaskService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_crypto_service', lambda: WebhookCryptoService(), scope=ServiceScope.SINGLETON)
    

    from ..services.webhooks.webhook_management_service import WebhookManagementService
    from ..services.webhooks.webhook_validation_service import WebhookValidationService
    from ..services.webhooks.webhook_execution_service import WebhookExecutionService
    from ..services.webhooks.webhook_service import WebhookService
    

    container.register('webhook_management_service', WebhookManagementService, scope=ServiceScope.SINGLETON)

    container.register('webhook_validation_service', WebhookValidationService, scope=ServiceScope.SINGLETON)

    container.register('webhook_execution_service', WebhookExecutionService, scope=ServiceScope.SINGLETON)

    container.register('webhook_service', WebhookService, scope=ServiceScope.SINGLETON)
    

    from ..services.tier_limits.tier_limits_service import TierLimitsService
    container.register('tier_limits_service', lambda: TierLimitsService(), scope=ServiceScope.SINGLETON)
    

    @app.teardown_request
    def cleanup_services(exception):
        """Cleanup request-scoped service instances after each request"""
        container.cleanup_request_instances()
    

    app.service_container = container