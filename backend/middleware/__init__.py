"""
Middleware package

This package contains Flask middleware components for request processing:
- activity_logger.py: Activity logging middleware
- auth.py: Authentication and authorization middleware
- rate_limiting.py: Rate limiting middleware
- validation.py: Request validation middleware

Import middleware directly from their modules:
- from .activity_logger import ActivityLoggerMiddleware
- from .auth import enforce_project_scope
- from .rate_limiting import connect_rate_limit
- etc.
"""

from .activity_logger import ActivityLoggerMiddleware

__all__ = ["ActivityLoggerMiddleware"]
