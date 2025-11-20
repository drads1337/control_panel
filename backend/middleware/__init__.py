"""
Middleware package
This package contains Flask middleware components for request processing:
- activity_logger.py: Activity logging middleware
- auth.py: Authentication and authorization middleware
- rate_limiting.py: Rate limiting middleware
- validation.py: Request validation middleware
- production_guard.py: Disables debug/test endpoints in production
- mtls.py: Mutual TLS validation for loader/client connections
Import middleware directly from their modules:
- from .activity_logger import ActivityLoggerMiddleware
- from .auth import enforce_project_scope
- from .rate_limiting import connect_rate_limit
- from .production_guard import development_only
- from .mtls import require_mtls
- etc.
"""
from .activity_logger import ActivityLoggerMiddleware
from .mtls import require_mtls, is_mtls_enabled
from .production_guard import development_only

__all__ = ["ActivityLoggerMiddleware", "require_mtls", "is_mtls_enabled", "development_only"]
