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
    
    # Register security services (singleton - stateless)
    from ..services.security.security_service import SecurityService
    from ..services.security.security_audit_service import SecurityAuditService
    from ..services.security.security_monitoring_service import SecurityMonitoringService
    from ..services.security.security_rules_service import SecurityRulesService
    from ..services.security.security_rules_init import SecurityRulesInitService
    container.register('security_service', lambda: SecurityService(), scope=ServiceScope.SINGLETON)
    container.register('security_audit_service', lambda: SecurityAuditService(), scope=ServiceScope.SINGLETON)
    container.register('security_monitoring_service', lambda: SecurityMonitoringService(), scope=ServiceScope.SINGLETON)
    container.register('security_rules_service', lambda: SecurityRulesService(), scope=ServiceScope.SINGLETON)
    container.register('security_rules_init_service', lambda: SecurityRulesInitService(), scope=ServiceScope.SINGLETON)
    
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
    
    # Register analytics buffer service (singleton - stateless)
    from ..services.analytics.analytics_buffer_service import AnalyticsBufferService
    container.register('analytics_buffer_service', lambda: AnalyticsBufferService(), scope=ServiceScope.SINGLETON)
    
    # Register persistence layer (singleton - stateless)
    from ..services.analytics.persistence_layer import PersistenceLayer
    container.register('persistence_layer', lambda: PersistenceLayer(), scope=ServiceScope.SINGLETON)
    
    # Register product services (singleton - stateless)
    from ..services.products.product_service import ProductService
    from ..services.products.price_calculation_service import PriceCalculationService
    container.register('product_service', lambda: ProductService(), scope=ServiceScope.SINGLETON)
    container.register('price_calculation_service', lambda: PriceCalculationService(), scope=ServiceScope.SINGLETON)
    
    # Register key services (singleton - stateless)
    from ..services.keys.key_crud_service import KeyCRUDService
    from ..services.keys.key_bulk_operations_service import KeyBulkOperationsService
    from ..services.keys.key_validation_service import KeyValidationService
    from ..services.keys.key_status_service import KeyStatusService
    from ..services.keys.key_statistics_service import KeyStatisticsService
    from ..services.keys.key_export_service import KeyExportService
    from ..services.keys.key_generation_service import KeyGenerationService
    from ..services.keys.key_validator import KeyValidator
    container.register('key_crud_service', lambda: KeyCRUDService(), scope=ServiceScope.SINGLETON)
    container.register('key_bulk_operations_service', lambda: KeyBulkOperationsService(), scope=ServiceScope.SINGLETON)
    container.register('key_validation_service', lambda: KeyValidationService(), scope=ServiceScope.SINGLETON)
    container.register('key_status_service', lambda: KeyStatusService(), scope=ServiceScope.SINGLETON)
    container.register('key_statistics_service', lambda: KeyStatisticsService(), scope=ServiceScope.SINGLETON)
    container.register('key_export_service', lambda: KeyExportService(), scope=ServiceScope.SINGLETON)
    container.register('key_generation_service', lambda: KeyGenerationService(), scope=ServiceScope.SINGLETON)
    container.register('key_validator', lambda: KeyValidator(), scope=ServiceScope.SINGLETON)
    
    # Register file service (singleton - stateless)
    from ..services.files.file_service import FileService
    container.register('file_service', lambda: FileService(), scope=ServiceScope.SINGLETON)
    
    # Register balance service (singleton - stateless)
    from ..services.balance.balance_service import BalanceService
    container.register('balance_service', lambda: BalanceService(), scope=ServiceScope.SINGLETON)
    
    # Register connect service (singleton - stateless)
    from ..services.connect.connect_service import ConnectService
    container.register('connect_service', lambda: ConnectService(), scope=ServiceScope.SINGLETON)
    
    # Register device update buffer (singleton - stateless)
    from ..services.connect.device_update_buffer import DeviceUpdateBuffer
    container.register('device_update_buffer', lambda: DeviceUpdateBuffer(), scope=ServiceScope.SINGLETON)
    
    # Register project services (singleton - stateless)
    from ..services.projects.project_service import ProjectService
    from ..services.projects.project_relationships_service import ProjectRelationshipsService
    container.register('project_service', lambda: ProjectService(), scope=ServiceScope.SINGLETON)
    container.register('project_relationships_service', lambda: ProjectRelationshipsService(), scope=ServiceScope.SINGLETON)
    
    # Register server service (singleton - stateless)
    from ..services.servers.server_service import ServerService
    container.register('server_service', lambda: ServerService(), scope=ServiceScope.SINGLETON)
    
    # Register log cleanup service (singleton - stateless)
    from ..services.logs.log_cleanup_service import LogCleanupService
    container.register('log_cleanup_service', lambda: LogCleanupService(), scope=ServiceScope.SINGLETON)
    
    # Register notification service (singleton - stateless)
    from ..services.notifications.notification_service import NotificationService
    container.register('notification_service', lambda: NotificationService(), scope=ServiceScope.SINGLETON)
    
    # Register heartbeat service (singleton - stateless)
    from ..services.heartbeat.heartbeat_service import HeartbeatService
    container.register('heartbeat_service', lambda: HeartbeatService(), scope=ServiceScope.SINGLETON)
    
    # Register task service (singleton - stateless)
    from ..services.tasks.task_service import TaskService
    container.register('task_service', lambda: TaskService(), scope=ServiceScope.SINGLETON)
    
    # Register dynamic config service (singleton - stateless)
    from ..services.dynamic_config.dynamic_config_service import DynamicConfigService
    container.register('dynamic_config_service', lambda: DynamicConfigService(), scope=ServiceScope.SINGLETON)
    
    # Register admin service (singleton - stateless)
    from ..services.admin.admin_service import AdminService
    container.register('admin_service', lambda: AdminService(), scope=ServiceScope.SINGLETON)
    
    # Register RBAC services (singleton - stateless)
    from ..services.rbac.authorization_audit import AuthorizationAuditService
    from ..services.rbac.abac_service import ABACService
    from ..services.rbac.role_service import RoleService
    from ..services.rbac.permission_service import PermissionService
    from ..services.rbac.policy_engine import PolicyEngine
    container.register('authorization_audit_service', lambda: AuthorizationAuditService(), scope=ServiceScope.SINGLETON)
    container.register('abac_service', lambda: ABACService(), scope=ServiceScope.SINGLETON)
    container.register('role_service', lambda: RoleService(), scope=ServiceScope.SINGLETON)
    container.register('permission_service', lambda: PermissionService(), scope=ServiceScope.SINGLETON)
    container.register('policy_engine', lambda: PolicyEngine(), scope=ServiceScope.SINGLETON)
    
    # Register user services (singleton - stateless)
    from ..services.users.two_factor_service import TwoFactorService
    from ..services.users.user_relationships_service import UserRelationshipsService
    from ..services.users.invite_service import InviteService
    container.register('two_factor_service', lambda: TwoFactorService(), scope=ServiceScope.SINGLETON)
    container.register('user_relationships_service', lambda: UserRelationshipsService(), scope=ServiceScope.SINGLETON)
    container.register('invite_service', lambda: InviteService(), scope=ServiceScope.SINGLETON)
    
    # Register auth services (singleton - stateless)
    from ..services.auth.challenge_service import ChallengeService
    from ..services.auth.login_service import LoginService
    from ..services.auth.auth_token_service import AuthTokenService
    container.register('challenge_service', lambda: ChallengeService(), scope=ServiceScope.SINGLETON)
    container.register('login_service', lambda: LoginService(), scope=ServiceScope.SINGLETON)
    container.register('auth_token_service', lambda: AuthTokenService(), scope=ServiceScope.SINGLETON)
    
    # Register monitoring service (singleton - stateless)
    from ..services.monitoring.prometheus_metrics_reader import PrometheusMetricsReader
    container.register('prometheus_metrics_reader', lambda: PrometheusMetricsReader(), scope=ServiceScope.SINGLETON)
    
    # Register validation service (singleton - stateless)
    from ..services.validation.request_validation_pipeline import RequestValidationPipeline
    container.register('request_validation_pipeline', lambda: RequestValidationPipeline(), scope=ServiceScope.SINGLETON)
    
    # Register webhook services (singleton - stateless)
    from ..services.webhooks.webhook_service import WebhookService
    from ..services.webhooks.webhook_management_service import WebhookManagementService
    from ..services.webhooks.webhook_validation_service import WebhookValidationService
    from ..services.webhooks.webhook_execution_service import WebhookExecutionService
    from ..services.webhooks.webhook_formatting_service import WebhookFormattingService
    from ..services.webhooks.webhook_logging_service import WebhookLoggingService
    from ..services.webhooks.webhook_testing_service import WebhookTestingService
    from ..services.webhooks.webhook_pending_task_service import WebhookPendingTaskService
    from ..services.webhooks.webhook_crypto_service import WebhookCryptoService
    
    container.register('webhook_service', lambda: WebhookService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_management_service', lambda: WebhookManagementService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_validation_service', lambda: WebhookValidationService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_execution_service', lambda: WebhookExecutionService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_formatting_service', lambda: WebhookFormattingService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_logging_service', lambda: WebhookLoggingService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_testing_service', lambda: WebhookTestingService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_pending_task_service', lambda: WebhookPendingTaskService(), scope=ServiceScope.SINGLETON)
    container.register('webhook_crypto_service', lambda: WebhookCryptoService(), scope=ServiceScope.SINGLETON)
    
    # Setup request cleanup handler
    @app.teardown_request
    def cleanup_services(exception):
        """Cleanup request-scoped service instances after each request"""
        container.cleanup_request_instances()
    
    # Store container in app for access via current_app
    app.service_container = container

