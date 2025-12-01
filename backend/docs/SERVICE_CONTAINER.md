# Service Container Documentation

## Overview

The Service Container (`service_container.py`) is a custom Dependency Injection (DI) container designed specifically for this Flask application. It provides centralized service management with support for different lifecycle scopes and automatic dependency resolution.

## Why Custom DI Container?

While standard libraries like `Dependency Injector` or `Punq` exist, this custom implementation was created to:
- Tailor to Flask's request context model
- Integrate seamlessly with existing codebase patterns
- Provide request-scoped services (via Flask's `g` object)
- Support lifecycle hooks (initialization and cleanup)

**Note**: The API is FROZEN. Breaking changes will affect the entire codebase. For new projects, consider using standard libraries, but for this codebase, maintain backward compatibility.

## Core Concepts

### Service Scopes

Services can be registered with three different scopes:

1. **SINGLETON** (default): One instance per application lifetime
   - Created once when first requested
   - Shared across all requests
   - Use for stateless services (e.g., `CacheService`, `AnalyticsService`)

2. **REQUEST**: One instance per Flask request
   - Created per HTTP request
   - Stored in Flask's `g` object
   - Automatically cleaned up after request
   - Use for request-specific services (e.g., services that need request context)

3. **TRANSIENT**: New instance on every `get()` call
   - Created fresh each time
   - No caching
   - Use for services that should not be shared (rare)

### Lifecycle Hooks

Services can implement lifecycle hooks:

- `on_init(instance)`: Called after instance creation
- `on_cleanup(instance)`: Called before instance cleanup (for request-scoped services)

## Usage

### Basic Registration

```python
from ..core.service_container import get_service_container, ServiceScope

container = get_service_container()

# Register a service
container.register('my_service', MyService, scope=ServiceScope.SINGLETON)
```

### Getting Services

**In routes/services (recommended):**
```python
from ..utils.service_helpers import get_service

my_service = get_service('my_service')
```

**Direct access:**
```python
from ..core.service_container import get_service_container

container = get_service_container()
my_service = container.get('my_service')
```

### Automatic Dependency Injection

The container supports automatic dependency injection based on constructor parameter names:

```python
class MyService:
    def __init__(self, cache_service, user_crud_service):
        # cache_service and user_crud_service are automatically resolved
        self.cache = cache_service
        self.user_service = user_crud_service
```

**Naming Convention:**
- Parameters ending with `_service` are automatically resolved
- Example: `key_validation_service` → resolves to `'key_validation_service'`
- Example: `_key_validation_service` → resolves to `'key_validation_service'` (leading underscore ignored)

**Non-service Parameters:**
These are NOT resolved as services (use defaults):
- `logger`, `log`, `config`, `settings`, `db`, `session`

### Request-Scoped Services

Request-scoped services are automatically cleaned up after each request:

```python
container.register('request_service', RequestService, scope=ServiceScope.REQUEST)
```

The container calls `cleanup_request_instances()` via Flask's teardown handler, which:
1. Calls `on_cleanup` hooks for request-scoped services
2. Clears instances from Flask's `g` object

## Service Registration Pattern

All services are registered in `init_services()` function in `service_container.py`:

```python
def init_services(app):
    container = get_service_container()
    
    # Register services
    container.register('user_crud_service', UserCRUDService, scope=ServiceScope.SINGLETON)
    container.register('cache_service', CacheService, scope=ServiceScope.SINGLETON)
    
    # Setup request cleanup
    @app.teardown_request
    def cleanup_services(exception):
        container.cleanup_request_instances()
```

## Circular Dependencies

The container handles circular dependencies gracefully:

1. Detects circular dependencies during construction
2. Attempts to inject non-circular dependencies
3. Falls back to default values for circular dependencies
4. Logs warnings for debugging

**Best Practice**: Avoid circular dependencies by:
- Using dependency inversion (interfaces/abstractions)
- Lazy loading (get service when needed, not in constructor)
- Refactoring to remove circular references

## Testing

For testing, you can register mock instances:

```python
container = get_service_container()
mock_service = MockService()
container.register_instance('my_service', mock_service, scope=ServiceScope.SINGLETON)
```

Or clear all instances:

```python
container.clear_all()  # Clears singleton and request-scoped instances
```

## Migration Notes

### From Direct Imports

**Before:**
```python
from ..services.users.user_crud_service import UserCRUDService
service = UserCRUDService()
```

**After:**
```python
from ..utils.service_helpers import get_service
service = get_service('user_crud_service')
```

### Adding New Services

1. Create service class in appropriate `services/` subdirectory
2. Register in `init_services()`:
   ```python
   from ..services.my_module.my_service import MyService
   container.register('my_service', MyService, scope=ServiceScope.SINGLETON)
   ```
3. Use via `get_service('my_service')` in routes/services

## Common Patterns

### Service with Dependencies

```python
class ComplexService:
    def __init__(self, cache_service, analytics_service, logger=None):
        self.cache = cache_service
        self.analytics = analytics_service
        self.logger = logger or logging.getLogger(__name__)
```

### Service with Lifecycle Hooks

```python
def on_init_hook(instance):
    instance.initialize()

def on_cleanup_hook(instance):
    instance.cleanup()

container.register(
    'my_service',
    MyService,
    scope=ServiceScope.REQUEST,
    on_init=on_init_hook,
    on_cleanup=on_cleanup_hook
)
```

## Troubleshooting

### Service Not Found

**Error**: `ValueError: Service 'my_service' is not registered`

**Solution**: Ensure service is registered in `init_services()` function

### Circular Dependency Warning

**Warning**: `Circular dependency detected for service_name`

**Solution**: 
1. Review dependency chain
2. Use lazy loading or dependency inversion
3. Consider refactoring architecture

### Request Context Error

**Error**: `RuntimeError: Working outside of request context`

**Solution**: 
- Ensure Flask request context is available
- Use `@app.before_request` or route decorators
- For background tasks, manually set request context

## API Reference

### ServiceContainer Methods

- `register(name, factory, scope, on_init, on_cleanup)`: Register a service
- `get(name)`: Get service instance (creates if needed)
- `register_instance(name, instance, scope)`: Register pre-created instance
- `clear()`: Clear singleton instances
- `clear_all()`: Clear all instances (testing only)
- `cleanup_request_instances()`: Cleanup request-scoped instances

### ServiceScope Enum

- `ServiceScope.SINGLETON`: One instance per application
- `ServiceScope.REQUEST`: One instance per request
- `ServiceScope.TRANSIENT`: New instance each time

## Best Practices

1. **Use SINGLETON for stateless services**: Most services should be singletons
2. **Use REQUEST for request-specific data**: Only when service needs request context
3. **Avoid TRANSIENT**: Rarely needed, consider if service should be singleton
4. **Name services consistently**: Use `*_service` suffix
5. **Document dependencies**: Add type hints and docstrings
6. **Test with mocks**: Use `register_instance()` for testing
7. **Avoid circular dependencies**: Refactor if detected

## Future Considerations

While the current implementation works well, consider:
- Migration to standard library (Dependency Injector) in future major version
- More sophisticated dependency resolution (type-based)
- Service health checks and monitoring
- Lazy initialization for expensive services

## Related Files

- `backend/core/service_container.py`: Main implementation
- `backend/core/app.py`: Application initialization
- `backend/utils/service_helpers.py`: Helper functions for getting services
- `backend/services/`: All service implementations